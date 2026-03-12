/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, useCallback } from "react";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // Free public TURN — critical for symmetric-NAT / corporate firewall networks
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

// ── Audio enhancement pipeline ───────────────────────────────────────────────
// Applies a Web Audio API processing chain on top of the raw getUserMedia stream:
//   source → highpass (cut rumble <80Hz) → lowpass (cut harshness >8kHz)
//          → presence boost (peaking EQ +3dB @ 3kHz) → dynamics compressor
//          → output gain → MediaStreamDestination
async function buildEnhancedAudioStream(rawStream) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });

    const source = audioCtx.createMediaStreamSource(rawStream);

    // 1. High-pass filter — removes low-frequency rumble / background hum
    const hp = audioCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 80;
    hp.Q.value = 0.7;

    // 2. Low-pass filter — removes harsh high-frequency noise
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 8000;
    lp.Q.value = 0.7;

    // 3. Presence boost — adds clarity / intelligibility around 3 kHz
    const presence = audioCtx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3000;
    presence.gain.value = 3;
    presence.Q.value = 1.0;

    // 4. Dynamics compressor — levels out volume, reduces sudden loud spikes
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
    compressor.knee.setValueAtTime(10, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    // 5. Output gain — slight reduction to avoid clipping after compression
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.85;

    // 6. Destination MediaStream
    const dest = audioCtx.createMediaStreamDestination();

    // Wire the chain
    source.connect(hp);
    hp.connect(lp);
    lp.connect(presence);
    presence.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(dest);

    // Build final stream: enhanced audio + original video tracks
    const enhancedStream = new MediaStream();
    dest.stream.getAudioTracks().forEach((t) => enhancedStream.addTrack(t));
    rawStream.getVideoTracks().forEach((t) => enhancedStream.addTrack(t));

    // Attach AudioContext reference for cleanup
    enhancedStream._audioCtx = audioCtx;

    return enhancedStream;
  } catch (err) {
    console.warn("Audio enhancement failed, falling back to raw stream:", err);
    return rawStream;
  }
}

export const useWebRTC = ({ socket, roomId, userId, userName }) => {
  const localStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});
  const peerScreenSendersRef = useRef({});
  const pendingIceRef = useRef({});
  const disconnectTimersRef = useRef({});

  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  // FIX: Expose reconnecting state so the UI can show a "reconnecting..." overlay
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Stable ref so async callbacks always have the latest socket
  const socketRef = useRef(socket);
  const userNameRef = useRef(userName);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // ── Renegotiate with one peer after addTrack / removeTrack ───────────────────
  const renegotiate = useCallback(async (sid) => {
    const pc = peersRef.current[sid];
    const s = socketRef.current;
    if (!pc || !s || pc.signalingState === "closed") return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      s.emit("offer", {
        to: sid,
        from: s.id,
        offer,
        userName: userNameRef.current,
      });
    } catch (e) {
      console.warn("renegotiate error", sid, e);
    }
  }, []);

  // ── Init camera / mic with noise cancellation + audio enhancement ─────────
  const initLocalStream = useCallback(async () => {
    try {
      // Request with hardware-level noise suppression hints
      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      // Apply software-level audio enhancement pipeline
      const s = await buildEnhancedAudioStream(rawStream);

      localStreamRef.current = s;
      camStreamRef.current = s;
      setLocalStream(s);
      return s;
    } catch {
      try {
        // Fallback: audio only if camera unavailable
        const rawStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const s = await buildEnhancedAudioStream(rawStream);
        localStreamRef.current = s;
        camStreamRef.current = s;
        setLocalStream(s);
        return s;
      } catch {
        return null;
      }
    }
  }, []);

  // ── Remove a peer ────────────────────────────────────────────────────────────
  const removePeer = useCallback((sid) => {
    if (disconnectTimersRef.current[sid]) {
      clearTimeout(disconnectTimersRef.current[sid]);
      delete disconnectTimersRef.current[sid];
    }
    if (peersRef.current[sid]) {
      peersRef.current[sid].close();
      delete peersRef.current[sid];
    }
    delete peerScreenSendersRef.current[sid];
    delete pendingIceRef.current[sid];
    setPeers((p) => p.filter((x) => x.socketId !== sid));
  }, []);

  // FIX: Clear ALL peer state before re-establishing connections after a rejoin.
  // Without this, stale peer entries from before the disconnect remain in the
  // React state and create ghost tiles that never get media.
  const clearAllPeers = useCallback(() => {
    // Cancel all pending disconnect timers first
    Object.entries(disconnectTimersRef.current).forEach(([, t]) =>
      clearTimeout(t),
    );
    disconnectTimersRef.current = {};

    // Close all RTCPeerConnections
    Object.values(peersRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peersRef.current = {};
    peerScreenSendersRef.current = {};
    pendingIceRef.current = {};

    // Clear React state so the grid rerenders with no ghost tiles
    setPeers([]);
  }, []);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (sid, remoteUserName) => {
      if (peersRef.current[sid]) {
        peersRef.current[sid].close();
        delete peersRef.current[sid];
      }

      const pc = new RTCPeerConnection(ICE);

      // Add camera tracks
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((t) => pc.addTrack(t, localStreamRef.current));
      }

      // If already screen-sharing when new peer joins, include screen track
      if (screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          const sender = pc.addTrack(screenTrack, screenStreamRef.current);
          peerScreenSendersRef.current[sid] = sender;
        }
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            to: sid,
            from: socketRef.current.id,
            candidate,
          });
        }
      };

      const remoteStream = new MediaStream();
      const remoteScreenStream = new MediaStream();
      // Counts only NEW video tracks — deduplicated so renegotiation re-fires
      // don't increment the counter and misroute the camera track to screen.
      let newVideoTrackCount = 0;

      pc.ontrack = ({ track }) => {
        // ── Deduplication ────────────────────────────────────────────────────
        // Renegotiation re-fires ontrack for already-placed tracks.
        // Refresh peer state (so screenStream ref updates) but don't re-route.
        const allKnown = [
          ...remoteStream.getTracks(),
          ...remoteScreenStream.getTracks(),
        ];
        if (allKnown.some((t) => t.id === track.id)) {
          const hasScreen = remoteScreenStream
            .getVideoTracks()
            .some((t) => t.readyState !== "ended");
          setPeers((prev) => {
            const updated = {
              socketId: sid,
              userName: remoteUserName,
              stream: remoteStream,
              screenStream: hasScreen ? remoteScreenStream : null,
            };
            const ex = prev.find((p) => p.socketId === sid);
            if (ex) return prev.map((p) => (p.socketId === sid ? updated : p));
            return [...prev, updated];
          });
          return;
        }

        // ── Route new track ──────────────────────────────────────────────────
        if (track.kind === "audio") {
          remoteStream.addTrack(track);
        } else {
          newVideoTrackCount += 1;
          if (newVideoTrackCount === 1) {
            remoteStream.addTrack(track); // first video = camera
          } else {
            remoteScreenStream.addTrack(track); // second video = screen share
          }
        }

        const hasScreen = remoteScreenStream
          .getVideoTracks()
          .some((t) => t.readyState !== "ended");
        setPeers((prev) => {
          const updated = {
            socketId: sid,
            userName: remoteUserName,
            stream: remoteStream,
            screenStream: hasScreen ? remoteScreenStream : null,
          };
          const ex = prev.find((p) => p.socketId === sid);
          if (ex) return prev.map((p) => (p.socketId === sid ? updated : p));
          return [...prev, updated];
        });
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] peer ${sid} state: ${pc.connectionState}`);

        if (pc.connectionState === "connected") {
          // Clear any pending disconnect timer
          if (disconnectTimersRef.current[sid]) {
            clearTimeout(disconnectTimersRef.current[sid]);
            delete disconnectTimersRef.current[sid];
          }
          return;
        }

        if (pc.connectionState === "disconnected") {
          if (disconnectTimersRef.current[sid]) return;
          // Step 1: Attempt ICE restart immediately — fixes most transient drops
          try {
            pc.restartIce();
          } catch (_) {}
          // Step 2: If still disconnected after 8s, remove the peer
          disconnectTimersRef.current[sid] = setTimeout(() => {
            const current = peersRef.current[sid];
            if (!current || current.connectionState !== "disconnected") return;
            console.warn(`[WebRTC] peer ${sid} did not recover, removing.`);
            removePeer(sid);
          }, 8000);
          return;
        }

        if (pc.connectionState === "failed") {
          // Try ICE restart first on failure before giving up
          try {
            pc.restartIce();
          } catch (_) {}
          // If still failed after 5 seconds, close the connection
          if (!disconnectTimersRef.current[`fail_${sid}`]) {
            disconnectTimersRef.current[`fail_${sid}`] = setTimeout(() => {
              delete disconnectTimersRef.current[`fail_${sid}`];
              const current = peersRef.current[sid];
              if (current && current.connectionState === "failed")
                removePeer(sid);
            }, 5000);
          }
          return;
        }

        if (pc.connectionState === "closed") {
          removePeer(sid);
        }
      };

      peersRef.current[sid] = pc;
      return pc;
    },
    [removePeer],
  );

  // ── Apply queued ICE candidates once a peer connection is ready ────────────
  const flushPendingIce = useCallback(async (sid) => {
    const pc = peersRef.current[sid];
    const queued = pendingIceRef.current[sid];
    if (!pc || !queued?.length || !pc.remoteDescription) return;

    const candidates = [...queued];
    pendingIceRef.current[sid] = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
  }, []);

  // ── Socket events ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // FIX: handleExistingPeers is called both on first join AND on rejoin after
    // a network drop. On rejoin we must ensure:
    //   1. All stale peer state is cleared first (done by Room.js calling
    //      clearAllPeers before emitting rejoin-room on the socket connect event).
    //   2. localStreamRef.current is valid — if it was null the createPeerConnection
    //      call won't add any tracks and media won't flow. We re-initialize here
    //      if necessary.
    const handleExistingPeers = async (existingPeers) => {
      // Ensure we have a working local stream before dialing out.
      // On first join initLocalStream() was already called by Room.js.
      // On rejoin the stream reference may still be valid (tracks are alive),
      // so we only re-init if the stream is actually gone.
      if (!localStreamRef.current) {
        console.warn(
          "[WebRTC] localStream missing on existing-peers — re-initializing",
        );
        await initLocalStream();
      }

      setIsReconnecting(false);

      for (const peer of existingPeers) {
        const pc = createPeerConnection(peer.socketId, peer.userName);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", {
            to: peer.socketId,
            from: socket.id,
            offer,
            userName,
          });
        } catch (e) {
          console.warn("offer error", e);
        }
      }
    };

    const handleUserJoined = ({ socketId, userName: rName }) => {
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [
          ...prev,
          { socketId, userName: rName, stream: null, screenStream: null },
        ];
      });
    };

    const handleOffer = async ({ from, offer, userName: rName }) => {
      let pc = peersRef.current[from];
      if (!pc || pc.signalingState === "closed") {
        pc = createPeerConnection(from, rName);
      }
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: from, from: socket.id, answer });
      } catch (e) {
        console.warn("answer error", e);
      }
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (!pc || pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIce(from);
      } catch (e) {
        console.warn("setRemoteDescription error", e);
      }
    };

    const handleIce = async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (!candidate) return;
      if (!pc || !pc.remoteDescription) {
        if (!pendingIceRef.current[from]) pendingIceRef.current[from] = [];
        pendingIceRef.current[from].push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    };

    const handleUserLeft = ({ socketId }) => removePeer(socketId);
    const handleKicked = () => window.dispatchEvent(new Event("qm-kicked"));

    // FIX: When a peer rejoins after a network drop, they have a new socketId.
    // We must:
    //   1. Remove ANY stale entry for that socketId (shouldn't exist but be safe).
    //   2. Add a placeholder immediately so their name appears in the UI.
    //   3. Create a new RTCPeerConnection and send an offer.
    // The re-joining peer handles their own side via handleExistingPeers above.
    const handleUserRejoined = async ({ socketId, userName: rName }) => {
      console.log(`[WebRTC] peer rejoined: ${rName} (${socketId})`);

      // Remove stale connection for this socketId if any
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }

      // Show placeholder immediately — stream arrives once tracks flow
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [
          ...prev,
          { socketId, userName: rName, stream: null, screenStream: null },
        ];
      });

      // Ensure local stream is alive before creating the outbound connection
      if (!localStreamRef.current) {
        await initLocalStream();
      }

      // Create new peer connection and send offer to the rejoined peer
      const pc = createPeerConnection(socketId, rName);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          to: socketId,
          from: socket.id,
          offer,
          userName,
        });
      } catch (e) {
        console.warn("rejoin offer error", e);
      }
    };

    const handlePeerScreenStopped = ({ socketId }) => {
      // Null out the screenStream so the UI removes the screen tile.
      setPeers((prev) =>
        prev.map((p) =>
          p.socketId === socketId ? { ...p, screenStream: null } : p,
        ),
      );
    };

    socket.on("existing-peers", handleExistingPeers);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-rejoined", handleUserRejoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("user-left", handleUserLeft);
    socket.on("kicked", handleKicked);
    socket.on("peer-screen-stopped", handlePeerScreenStopped);

    return () => {
      socket.off("existing-peers", handleExistingPeers);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-rejoined", handleUserRejoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("user-left", handleUserLeft);
      socket.off("kicked", handleKicked);
      socket.off("peer-screen-stopped", handlePeerScreenStopped);
    };
  }, [socket, createPeerConnection, removePeer, initLocalStream, userName]);

  // ── Audio toggle ─────────────────────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setAudioEnabled(enabled);
    if (socket) socket.emit("toggle-audio", { roomId, userId, enabled });
  }, [audioEnabled, socket, roomId, userId]);

  // ── Video toggle ─────────────────────────────────────────────────────────────
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setVideoEnabled(enabled);
    if (socket) socket.emit("toggle-video", { roomId, userId, enabled });
  }, [videoEnabled, socket, roomId, userId]);

  // ── Screen share toggle ──────────────────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setScreenSharing(false);

      for (const sid of Object.keys(peersRef.current)) {
        const pc = peersRef.current[sid];
        const sender = peerScreenSendersRef.current[sid];
        if (sender && pc) {
          try {
            pc.removeTrack(sender);
          } catch {}
          delete peerScreenSendersRef.current[sid];
          await renegotiate(sid);
        }
      }

      if (socketRef.current)
        socketRef.current.emit("screen-share-stopped", { roomId });
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false,
        });

        screenStreamRef.current = ss;
        const screenTrack = ss.getVideoTracks()[0];

        for (const sid of Object.keys(peersRef.current)) {
          const pc = peersRef.current[sid];
          const sender = pc.addTrack(screenTrack, ss);
          peerScreenSendersRef.current[sid] = sender;
          await renegotiate(sid);
        }

        setScreenStream(ss);
        setScreenSharing(true);

        screenTrack.onended = async () => {
          screenStreamRef.current?.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
          setScreenStream(null);
          setScreenSharing(false);

          for (const sid of Object.keys(peersRef.current)) {
            const pc = peersRef.current[sid];
            const sender = peerScreenSendersRef.current[sid];
            if (sender && pc) {
              try {
                pc.removeTrack(sender);
              } catch {}
              delete peerScreenSendersRef.current[sid];
              await renegotiate(sid);
            }
          }

          if (socketRef.current)
            socketRef.current.emit("screen-share-stopped", { roomId });
        };
      } catch (e) {
        console.error("Screen share failed:", e);
      }
    }
  }, [screenSharing, roomId, renegotiate]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    Object.values(disconnectTimersRef.current).forEach((t) => clearTimeout(t));
    disconnectTimersRef.current = {};
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    peerScreenSendersRef.current = {};
    pendingIceRef.current = {};
    // Close the Web Audio processing context to free resources
    if (localStreamRef.current?._audioCtx) {
      localStreamRef.current._audioCtx.close().catch(() => {});
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    camStreamRef.current = null;
    setPeers([]);
    setLocalStream(null);
    setScreenStream(null);
  }, []);

  return {
    localStream,
    screenStream,
    peers,
    audioEnabled,
    videoEnabled,
    screenSharing,
    isReconnecting,
    initLocalStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,
    clearAllPeers,
  };
};
