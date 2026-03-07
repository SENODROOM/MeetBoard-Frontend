/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, useCallback } from "react";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useWebRTC = ({ socket, roomId, userId, userName }) => {
  const localStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});
  const peerScreenSendersRef = useRef({});

  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

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
  // WebRTC does NOT automatically tell the remote side about new/removed tracks.
  // We must create a new offer and send it through signalling every time.
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

  // ── Init camera / mic ────────────────────────────────────────────────────────
  const initLocalStream = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = s;
      camStreamRef.current = s;
      setLocalStream(s);
      return s;
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
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
    if (peersRef.current[sid]) {
      peersRef.current[sid].close();
      delete peersRef.current[sid];
    }
    delete peerScreenSendersRef.current[sid];
    setPeers((p) => p.filter((x) => x.socketId !== sid));
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

      // If we are already screen-sharing when this new peer joins, add the screen
      // track NOW — before we call createOffer — so it is included in the very
      // first offer and no separate renegotiation is needed for this peer.
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

      // Separate incoming tracks: track 1 = camera, track 2 = screen share
      const remoteStream = new MediaStream();
      const remoteScreenStream = new MediaStream();
      let videoTrackCount = 0;

      pc.ontrack = ({ track }) => {
        if (track.kind === "audio") {
          remoteStream.addTrack(track);
        } else {
          videoTrackCount += 1;
          if (videoTrackCount === 1) {
            remoteStream.addTrack(track); // first video = camera
          } else {
            remoteScreenStream.addTrack(track); // second video = screen
          }
        }

        const hasScreen = remoteScreenStream.getVideoTracks().length > 0;
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
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          removePeer(sid);
        }
      };

      peersRef.current[sid] = pc;
      return pc;
    },
    [removePeer],
  );

  // ── Socket events ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleExistingPeers = async (existingPeers) => {
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
        // Renegotiation offers can arrive while we already have a local offer
        // (the remote peer added their screen track). Roll back our local offer first.
        if (pc.signalingState === "have-local-offer") {
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
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
      } catch (e) {
        console.warn("setRemoteDescription error", e);
      }
    };

    const handleIce = async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    };

    const handleUserLeft = ({ socketId }) => removePeer(socketId);
    const handleKicked = () => window.dispatchEvent(new Event("qm-kicked"));

    const handlePeerScreenStopped = ({ socketId }) => {
      setPeers((prev) =>
        prev.map((p) =>
          p.socketId === socketId ? { ...p, screenStream: null } : p,
        ),
      );
    };

    socket.on("existing-peers", handleExistingPeers);
    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("user-left", handleUserLeft);
    socket.on("kicked", handleKicked);
    socket.on("peer-screen-stopped", handlePeerScreenStopped);

    return () => {
      socket.off("existing-peers", handleExistingPeers);
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("user-left", handleUserLeft);
      socket.off("kicked", handleKicked);
      socket.off("peer-screen-stopped", handlePeerScreenStopped);
    };
  }, [socket, createPeerConnection, removePeer, userName]);

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
      // ── STOP ────────────────────────────────────────────────────────────────
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setScreenSharing(false);

      // Remove screen sender from every peer then renegotiate so the remote
      // side removes the track from its stream.
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
      // ── START ────────────────────────────────────────────────────────────────
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false,
        });

        screenStreamRef.current = ss;
        const screenTrack = ss.getVideoTracks()[0];

        // Add screen track to each connected peer then renegotiate.
        // THE CRITICAL PART: without renegotiate() the remote peer's ontrack
        // never fires — addTrack alone is completely silent on an established connection.
        for (const sid of Object.keys(peersRef.current)) {
          const pc = peersRef.current[sid];
          const sender = pc.addTrack(screenTrack, ss);
          peerScreenSendersRef.current[sid] = sender;
          await renegotiate(sid); // ← sends new offer so remote ontrack fires
        }

        setScreenStream(ss);
        setScreenSharing(true);

        // Browser "Stop sharing" button
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
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    peerScreenSendersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
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
    initLocalStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,
  };
};
