import * as Ably from "ably";

const API = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

// Vercel can't host a persistent Socket.io server, so this client talks to
// Ably (managed pub/sub + presence) instead. To avoid touching every
// component that used to call `socket.emit`/`socket.on`, this factory
// returns an object with the same shape (`emit`, `on`, `off`, `id`,
// `disconnect`) — callers don't need to change.
//
// Identity: Ably's `clientId` is set to our app's userId, so anywhere the
// old code used a socket.io `socketId` to address a peer, that value is now
// simply the peer's userId — the two concepts are unified.

// Server used to relay `socket.on(X)` straight into a renamed `.emit(Y)`.
// Same renames, done client-side now.
const RELAY_RENAME = {
  "toggle-audio": (d, selfId) => [
    "peer-audio-toggle",
    { userId: d.userId, socketId: selfId, enabled: d.enabled },
  ],
  "toggle-video": (d, selfId) => [
    "peer-video-toggle",
    { userId: d.userId, socketId: selfId, enabled: d.enabled },
  ],
  "room-reaction": (d) => ["peer-reaction", { emoji: d.emoji, x: d.x, y: d.y }],
  "raise-hand": (d, selfId) => [
    "peer-hand-raise",
    { socketId: selfId, userName: d.userName },
  ],
  "lower-hand": (_d, selfId) => ["peer-hand-lower", { socketId: selfId }],
  "screen-share-stopped": (_d, selfId) => [
    "peer-screen-stopped",
    { socketId: selfId },
  ],
  "wb-join": (_d, selfId) => ["wb-request-canvas", { from: selfId }],
  "transcript-share": (d) => [
    "transcript-line",
    { text: d.text, speakerName: d.speakerName, timestamp: d.timestamp },
  ],
};

// Relayed to the room unchanged (some carry a `to` for point-to-point).
const DIRECT_BROADCAST = new Set([
  "offer",
  "answer",
  "ice-candidate",
  "wb-draw",
  "wb-clear",
  "wb-cursor",
  "wb-canvas-state",
  "wb-image-drop",
  "wb-image-move",
  "wb-image-resize",
  "wb-image-delete",
  "wb-drawing-start",
  "wb-drawing-stop",
]);

async function postJSON(url, body) {
  const res = await fetch(`${API}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.ok ? res.json().catch(() => ({})) : Promise.reject(res);
}
async function patchJSON(url, body) {
  const res = await fetch(`${API}${url}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.ok ? res.json().catch(() => ({})) : Promise.reject(res);
}
async function delJSON(url, body) {
  const res = await fetch(`${API}${url}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.ok ? res.json().catch(() => ({})) : Promise.reject(res);
}
async function getJSON(url) {
  const res = await fetch(`${API}${url}`);
  return res.ok ? res.json().catch(() => null) : null;
}

export function createRealtimeClient({ roomId, userId, userName }) {
  const listeners = new Map(); // event -> Set<fn>
  const clientConnCounts = new Map(); // clientId -> Set<connectionId>
  let hasEnteredPresence = false;

  const dispatch = (event, data) => {
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(`[realtime] listener for ${event} threw`, e);
      }
    });
  };

  const ably = new Ably.Realtime({
    authCallback: async (_params, cb) => {
      try {
        const tokenRequest = await postJSON("/api/realtime/token", {
          userId,
          roomId,
        });
        cb(null, tokenRequest);
      } catch (err) {
        cb(err, null);
      }
    },
    clientId: userId,
    echoMessages: false, // mirrors socket.to(room).emit(...) excluding the sender
  });

  // `roomId` is optional — Home.js's SecretMeet queue has no room yet, only
  // needs its personal `secret:{userId}` inbox until a match hands it one.
  const channel = roomId ? ably.channels.get("room:" + roomId) : null;
  const secretChannel = ably.channels.get("secret:" + userId);

  // ── Generic channel messages (broadcast + targeted-via-`to`) ───────────────
  if (channel) {
    channel.subscribe((msg) => {
      if (msg.data && msg.data.to && msg.data.to !== userId) return; // not for me
      dispatch(msg.name, msg.data);
    });

    // ── Presence → user-joined / user-rejoined / user-left ───────────────────
    channel.presence.subscribe("enter", (msg) => {
      if (msg.clientId === userId) return;
      const seen = clientConnCounts.has(msg.clientId);
      if (!clientConnCounts.get(msg.clientId))
        clientConnCounts.set(msg.clientId, new Set());
      clientConnCounts.get(msg.clientId).add(msg.connectionId);
      dispatch(seen ? "user-rejoined" : "user-joined", {
        socketId: msg.clientId,
        userId: msg.clientId,
        userName: msg.data?.userName,
      });
    });
    channel.presence.subscribe("leave", (msg) => {
      const set = clientConnCounts.get(msg.clientId);
      if (!set) return;
      set.delete(msg.connectionId);
      if (set.size === 0) {
        clientConnCounts.delete(msg.clientId);
        dispatch("user-left", { socketId: msg.clientId, userName: msg.data?.userName });
      }
    });
  }
  secretChannel.subscribe("secret-matched", (msg) => dispatch("secret-matched", msg.data));

  ably.connection.on("connected", () => dispatch("connect"));
  ably.connection.on("failed", () => dispatch("reconnect_failed"));
  ably.connection.on("suspended", () => dispatch("reconnect_failed"));

  const enterPresenceAndHydrate = async () => {
    await channel.presence.enter({ userId, userName });
    hasEnteredPresence = true;

    const members = await channel.presence.get();
    const seenIds = new Set();
    const peers = [];
    for (const m of members) {
      if (m.clientId === userId) continue;
      if (!clientConnCounts.get(m.clientId))
        clientConnCounts.set(m.clientId, new Set());
      clientConnCounts.get(m.clientId).add(m.connectionId);
      if (seenIds.has(m.clientId)) continue;
      seenIds.add(m.clientId);
      peers.push({ socketId: m.clientId, userId: m.clientId, userName: m.data?.userName });
    }
    dispatch("existing-peers", peers);

    const room = await getJSON(`/api/rooms/${roomId}`);
    if (room?.host === userId) {
      dispatch("host-status-confirmed", { isHost: true });
      const knocks = await getJSON(`/api/rooms/${roomId}/knocks?userId=${userId}`);
      (knocks || []).forEach((k) =>
        dispatch("knock-request", { socketId: k.userId, userId: k.userId, userName: k.userName }),
      );
    }

    const history = await getJSON(`/api/rooms/${roomId}/chat`);
    dispatch("chat-history", history || []);
  };

  async function restDispatch(event, data) {
    switch (event) {
      case "join-room":
      case "rejoin-room":
        await enterPresenceAndHydrate();
        return;

      case "knock":
        await postJSON(`/api/rooms/${roomId}/knock`, {
          userId: data.userId,
          userName: data.userName,
        }).catch(() => {});
        return;

      case "admit-user":
        await postJSON(`/api/rooms/${roomId}/admit`, {
          userId,
          targetUserId: data.socketId,
        }).catch(() => {});
        return;
      case "reject-user":
        await postJSON(`/api/rooms/${roomId}/reject`, {
          userId,
          targetUserId: data.socketId,
        }).catch(() => {});
        return;
      case "kick-user":
        await postJSON(`/api/rooms/${roomId}/kick`, {
          userId,
          targetUserId: data.targetSocketId,
        }).catch(() => {});
        return;

      case "host-mute-user":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "mute-user",
          targetUserId: data.targetSocketId,
        }).catch(() => {});
      case "host-unmute-user":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "unmute-user",
          targetUserId: data.targetSocketId,
        }).catch(() => {});
      case "host-mute-all":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "mute-all",
        }).catch(() => {});
      case "host-stop-video":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "stop-video",
          targetUserId: data.targetSocketId,
        }).catch(() => {});
      case "host-wb-permission":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "wb-permission",
          targetUserId: data.targetSocketId,
          allowed: data.allowed,
        }).catch(() => {});
      case "host-lower-all-hands":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "lower-all-hands",
        }).catch(() => {});
      case "host-grant-transcribe":
        return postJSON(`/api/rooms/${roomId}/host-action`, {
          userId,
          action: "grant-transcribe",
          targetUserId: data.targetSocketId,
          allowed: data.allowed,
        }).catch(() => {});

      case "chat-message":
        return postJSON(`/api/rooms/${roomId}/chat`, {
          message: data.message,
          userName: data.userName,
          userId: data.userId,
        }).catch(() => {});

      case "poll-create":
        return postJSON(`/api/rooms/${roomId}/polls`, {
          userId,
          question: data.question,
          options: data.options,
          createdBy: userName,
        }).catch(() => {});
      case "poll-vote":
        return postJSON(`/api/rooms/${roomId}/polls/${data.pollId}/vote`, {
          userId: data.userId,
          optionIndex: data.optionIndex,
        }).catch(() => {});
      case "poll-end":
        return postJSON(`/api/rooms/${roomId}/polls/${data.pollId}/end`, {
          userId,
        }).catch(() => {});
      case "poll-get-all": {
        const polls = await getJSON(`/api/rooms/${roomId}/polls`);
        dispatch("poll-all", polls || []);
        return;
      }

      case "qna-ask":
        return postJSON(`/api/rooms/${roomId}/qna`, {
          text: data.text,
          askerId: data.askerId,
          askerName: data.askerName,
          anonymous: data.anonymous,
        }).catch(() => {});
      case "qna-upvote":
        return postJSON(`/api/rooms/${roomId}/qna/${data.questionId}/upvote`, {
          userId: data.userId,
        }).catch(() => {});
      case "qna-mark-answered":
        return patchJSON(
          `/api/rooms/${roomId}/qna/${data.questionId}/answered`,
          { userId },
        ).catch(() => {});
      case "qna-pin":
        return patchJSON(`/api/rooms/${roomId}/qna/${data.questionId}/pin`, {
          userId,
        }).catch(() => {});
      case "qna-dismiss":
        return delJSON(`/api/rooms/${roomId}/qna/${data.questionId}`, {
          userId,
        }).catch(() => {});
      case "qna-get-all": {
        const qs = await getJSON(`/api/rooms/${roomId}/qna`);
        dispatch("qna-all", qs || []);
        return;
      }

      case "breakout-create":
        return postJSON(`/api/rooms/${roomId}/breakout`, {
          userId,
          breakoutRooms: data.breakoutRooms,
        }).catch(() => {});
      case "breakout-assign":
        return postJSON(`/api/rooms/${roomId}/breakout/assign`, {
          userId,
          targetUserId: data.targetSocketId,
          breakoutRoomId: data.breakoutRoomId,
        }).catch(() => {});
      case "breakout-end":
        return delJSON(`/api/rooms/${roomId}/breakout`, { userId }).catch(() => {});
      case "breakout-broadcast":
        return postJSON(`/api/rooms/${roomId}/breakout/broadcast`, {
          userId,
          message: data.message,
        }).catch(() => {});
      case "breakout-call-back":
        return postJSON(`/api/rooms/${roomId}/breakout/callback`, {
          userId,
        }).catch(() => {});
      case "breakout-get": {
        const state = await getJSON(`/api/rooms/${roomId}/breakout`);
        dispatch("breakout-state", state || null);
        return;
      }

      case "secret-join-queue": {
        const result = await postJSON("/api/secret/join", {
          userId: data.userId || userId,
          userName: data.userName || userName,
        }).catch(() => null);
        if (!result) return;
        if (result.status === "matched") {
          dispatch("secret-matched", {
            roomId: result.roomId,
            partnerName: result.partnerName,
          });
        } else {
          dispatch("secret-waiting");
        }
        return;
      }
      case "secret-leave-queue":
        await postJSON("/api/secret/leave", { userId: data.userId || userId }).catch(() => {});
        dispatch("secret-cancelled");
        return;

      default:
        return;
    }
  }

  const socketLike = {
    id: userId,
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, data) {
      if (RELAY_RENAME[event]) {
        const [name, payload] = RELAY_RENAME[event](data || {}, userId);
        channel.publish(name, payload).catch(() => {});
        return;
      }
      if (DIRECT_BROADCAST.has(event)) {
        channel.publish(event, data).catch(() => {});
        return;
      }
      restDispatch(event, data || {}).catch((e) =>
        console.warn(`[realtime] ${event} failed`, e),
      );
    },
    disconnect() {
      if (hasEnteredPresence && channel) channel.presence.leave().catch(() => {});
      ably.close();
    },
  };

  return socketLike;
}
