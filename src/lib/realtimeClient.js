import { v4 as uuidv4 } from "uuid";

const API = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

// Vercel can't host Socket.io. Signaling + room fan-out use a Mongo-backed
// event bus polled over REST. Media stays WebRTC P2P. This factory keeps the
// socket-shaped API (`emit` / `on` / `off` / `id` / `disconnect`) so Room and
// useWebRTC don't need to change. Peer addressing uses userId as socketId.

const POLL_MS_IDLE = 2000;
const POLL_MS_ACTIVE = 400;
const POLL_MS_NEGOTIATING = 250;
const HEARTBEAT_MS = 8_000;
const LONG_POLL_WAIT_MS = 20000;

const SIGNALING_EVENTS = new Set([
  "offer",
  "answer",
  "ice-candidate",
]);

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

export function createRealtimeClient({ roomId, userId, userName, roomToken }) {
  const listeners = new Map();
  const connectionId = uuidv4();
  let hasEnteredPresence = false;
  let closed = false;
  let roomSince = new Date().toISOString();
  let secretSince = new Date().toISOString();
  let pollTimer = null;
  let heartbeatTimer = null;
  let cursorTimer = null;
  let pendingCursor = null;
  let polling = false;
  let negotiatingUntil = 0;
  let lastActivity = Date.now();
  let useLongPoll = true;
  let token = roomToken || (roomId ? localStorage.getItem(`qm_room_token_${roomId}`) : null);

  const setRoomToken = (t) => {
    token = t;
    if (roomId && t) localStorage.setItem(`qm_room_token_${roomId}`, t);
  };

  const withToken = (body) => ({ ...(body || {}), roomToken: token || undefined });

  const markActivity = (event) => {
    lastActivity = Date.now();
    if (SIGNALING_EVENTS.has(event)) {
      negotiatingUntil = Date.now() + 8000;
    }
  };

  const currentPollMs = () => {
    if (Date.now() < negotiatingUntil) return POLL_MS_NEGOTIATING;
    if (Date.now() - lastActivity < 5000) return POLL_MS_ACTIVE;
    return POLL_MS_IDLE;
  };

  const dispatch = (event, data) => {
    markActivity(event);
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(`[realtime] listener for ${event} threw`, e);
      }
    });
  };

  const publishEvent = async (event, payload) => {
    if (!roomId || closed) return;
    markActivity(event);
    await postJSON(`/api/rooms/${roomId}/events`, {
      event,
      payload: payload || {},
      from: userId,
      to: payload?.to ?? null,
    });
  };

  const publishRoomEvent = (event, payload) => {
    if (event === "wb-cursor") {
      pendingCursor = payload;
      if (!cursorTimer) {
        cursorTimer = setTimeout(() => {
          cursorTimer = null;
          const p = pendingCursor;
          pendingCursor = null;
          if (p) publishEvent("wb-cursor", p).catch(() => {});
        }, 80);
      }
      return;
    }
    publishEvent(event, payload).catch(() => {});
  };

  const pollOnce = async () => {
    if (closed || polling) return;
    polling = true;
    try {
      if (roomId) {
        const q = new URLSearchParams({ userId, since: roomSince });
        if (useLongPoll) q.set("wait", String(LONG_POLL_WAIT_MS));
        const data = await getJSON(`/api/rooms/${roomId}/events?${q}`);
        if (data?.events?.length) {
          for (const ev of data.events) {
            dispatch(ev.event, ev.payload);
            if (ev.createdAt > roomSince) roomSince = ev.createdAt;
          }
        }
      } else {
        const q = new URLSearchParams({ userId, since: secretSince });
        const data = await getJSON(`/api/secret/inbox?${q}`);
        if (data?.events?.length) {
          for (const ev of data.events) {
            dispatch(ev.event, ev.payload);
            if (ev.createdAt > secretSince) secretSince = ev.createdAt;
          }
        }
      }
    } catch (e) {
      useLongPoll = false; // fall back to short poll on transport errors
    } finally {
      polling = false;
    }
  };

  const scheduleNextPoll = () => {
    if (closed) return;
    const delay = useLongPoll && roomId ? 50 : currentPollMs();
    pollTimer = setTimeout(async () => {
      await pollOnce();
      scheduleNextPoll();
    }, delay);
  };

  const startPolling = () => {
    if (pollTimer) return;
    scheduleNextPoll();
  };

  const startHeartbeat = () => {
    if (heartbeatTimer || !roomId) return;
    heartbeatTimer = setInterval(() => {
      postJSON(`/api/rooms/${roomId}/presence`, {
        userId,
        userName,
        connectionId,
        heartbeat: true,
      }).catch(() => {});
    }, HEARTBEAT_MS);
  };

  const enterPresenceAndHydrate = async () => {
    const result = await postJSON(`/api/rooms/${roomId}/presence`, {
      userId,
      userName,
      connectionId,
    });
    hasEnteredPresence = true;
    startHeartbeat();

    const members = result?.members || (await getJSON(`/api/rooms/${roomId}/presence`)) || [];
    const peers = members
      .filter((m) => m.userId !== userId)
      .map((m) => ({
        socketId: m.userId,
        userId: m.userId,
        userName: m.userName,
      }));
    dispatch("existing-peers", peers);

    const room = await getJSON(`/api/rooms/${roomId}`);
    let hostConfirmed = false;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        hostConfirmed =
          payload.role === "host" &&
          payload.roomId === roomId &&
          payload.userId === userId;
      } catch {}
    }
    if (hostConfirmed || room?.host === userId) {
      if (!hostConfirmed && room?.host === userId) {
        // Legacy: creator without token cannot elevate; only confirm UI if token present
      }
      if (hostConfirmed) {
        dispatch("host-status-confirmed", { isHost: true });
        const knocks = await getJSON(
          `/api/rooms/${roomId}/knocks?userId=${encodeURIComponent(userId)}&roomToken=${encodeURIComponent(token)}`,
        );
        (knocks || []).forEach((k) =>
          dispatch("knock-request", {
            socketId: k.userId,
            userId: k.userId,
            userName: k.userName,
          }),
        );
      }
    }

    const history = await getJSON(`/api/rooms/${roomId}/chat`);
    dispatch("chat-history", history || []);

    // Skip historical join/leave fan-out already reflected in existing-peers
    roomSince = new Date().toISOString();
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
        await postJSON(
          `/api/rooms/${roomId}/admit`,
          withToken({ userId, targetUserId: data.socketId }),
        ).catch(() => {});
        return;
      case "reject-user":
        await postJSON(
          `/api/rooms/${roomId}/reject`,
          withToken({ userId, targetUserId: data.socketId }),
        ).catch(() => {});
        return;
      case "kick-user":
        await postJSON(
          `/api/rooms/${roomId}/kick`,
          withToken({ userId, targetUserId: data.targetSocketId }),
        ).catch(() => {});
        return;

      case "host-mute-user":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({
            userId,
            action: "mute-user",
            targetUserId: data.targetSocketId,
          }),
        ).catch(() => {});
      case "host-unmute-user":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({
            userId,
            action: "unmute-user",
            targetUserId: data.targetSocketId,
          }),
        ).catch(() => {});
      case "host-mute-all":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({ userId, action: "mute-all" }),
        ).catch(() => {});
      case "host-stop-video":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({
            userId,
            action: "stop-video",
            targetUserId: data.targetSocketId,
          }),
        ).catch(() => {});
      case "host-wb-permission":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({
            userId,
            action: "wb-permission",
            targetUserId: data.targetSocketId,
            allowed: data.allowed,
          }),
        ).catch(() => {});
      case "host-lower-all-hands":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({ userId, action: "lower-all-hands" }),
        ).catch(() => {});
      case "host-grant-transcribe":
        return postJSON(
          `/api/rooms/${roomId}/host-action`,
          withToken({
            userId,
            action: "grant-transcribe",
            targetUserId: data.targetSocketId,
            allowed: data.allowed,
          }),
        ).catch(() => {});

      case "chat-message":
        return postJSON(`/api/rooms/${roomId}/chat`, {
          message: data.message,
          userName: data.userName,
          userId: data.userId,
        }).catch(() => {});

      case "poll-create":
        return postJSON(
          `/api/rooms/${roomId}/polls`,
          withToken({
            userId,
            question: data.question,
            options: data.options,
            createdBy: userName,
          }),
        ).catch(() => {});
      case "poll-vote":
        return postJSON(`/api/rooms/${roomId}/polls/${data.pollId}/vote`, {
          userId: data.userId,
          optionIndex: data.optionIndex,
        }).catch(() => {});
      case "poll-end":
        return postJSON(
          `/api/rooms/${roomId}/polls/${data.pollId}/end`,
          withToken({ userId }),
        ).catch(() => {});
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
          withToken({ userId }),
        ).catch(() => {});
      case "qna-pin":
        return patchJSON(
          `/api/rooms/${roomId}/qna/${data.questionId}/pin`,
          withToken({ userId }),
        ).catch(() => {});
      case "qna-dismiss":
        return delJSON(
          `/api/rooms/${roomId}/qna/${data.questionId}`,
          withToken({ userId }),
        ).catch(() => {});
      case "qna-get-all": {
        const qs = await getJSON(`/api/rooms/${roomId}/qna`);
        dispatch("qna-all", qs || []);
        return;
      }

      case "breakout-create":
        return postJSON(
          `/api/rooms/${roomId}/breakout`,
          withToken({ userId, breakoutRooms: data.breakoutRooms }),
        ).catch(() => {});
      case "breakout-assign":
        return postJSON(
          `/api/rooms/${roomId}/breakout/assign`,
          withToken({
            userId,
            targetUserId: data.targetSocketId,
            breakoutRoomId: data.breakoutRoomId,
          }),
        ).catch(() => {});
      case "breakout-end":
        return delJSON(
          `/api/rooms/${roomId}/breakout`,
          withToken({ userId }),
        ).catch(() => {});
      case "breakout-broadcast":
        return postJSON(
          `/api/rooms/${roomId}/breakout/broadcast`,
          withToken({ userId, message: data.message }),
        ).catch(() => {});
      case "breakout-call-back":
        return postJSON(
          `/api/rooms/${roomId}/breakout/callback`,
          withToken({ userId }),
        ).catch(() => {});
      case "breakout-get": {
        const state = await getJSON(`/api/rooms/${roomId}/breakout`);
        dispatch("breakout-state", state || null);
        return;
      }

      case "secret-join-queue": {
        // Ensure inbox polling is running for the waiting partner path
        startPolling();
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
        await postJSON("/api/secret/leave", {
          userId: data.userId || userId,
        }).catch(() => {});
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
        publishRoomEvent(name, payload);
        return;
      }
      if (DIRECT_BROADCAST.has(event)) {
        publishRoomEvent(event, data || {});
        return;
      }
      restDispatch(event, data || {}).catch((e) =>
        console.warn(`[realtime] ${event} failed`, e),
      );
    },
    disconnect() {
      closed = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (cursorTimer) clearTimeout(cursorTimer);
      pollTimer = heartbeatTimer = cursorTimer = null;
      if (hasEnteredPresence && roomId) {
        delJSON(`/api/rooms/${roomId}/presence`, {
          userId,
          userName,
          connectionId,
        }).catch(() => {});
      }
    },
    setRoomToken,
  };

  // Room clients poll immediately; SecretMeet (no roomId) starts on queue join
  // but also poll inbox so a late subscribe still works if emit order varies.
  queueMicrotask(() => {
    if (closed) return;
    dispatch("connect");
    if (roomId) startPolling();
    else startPolling();
  });

  return socketLike;
}
