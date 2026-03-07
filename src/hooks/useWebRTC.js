/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, useCallback } from 'react';

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = ({ socket, roomId, userId, userName }) => {
  const localStreamRef  = useRef(null);   // always the camera stream
  const camStreamRef    = useRef(null);   // dedicated camera stream backup
  const peersRef        = useRef({});
  const [peers, setPeers]               = useState([]);
  const [localStream, setLocalStream]   = useState(null);   // camera stream (always)
  const [screenStream, setScreenStream] = useState(null);   // screen share stream (or null)
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);

  const initLocalStream = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      camStreamRef.current   = s;
      setLocalStream(s);
      return s;
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = s;
        camStreamRef.current   = s;
        setLocalStream(s);
        return s;
      } catch { return null; }
    }
  }, []);

  const removePeer = useCallback((sid) => {
    if (peersRef.current[sid]) {
      peersRef.current[sid].close();
      delete peersRef.current[sid];
    }
    setPeers((p) => p.filter((x) => x.socketId !== sid));
  }, []);

  const createPeerConnection = useCallback((sid, remoteUserName) => {
    if (peersRef.current[sid]) {
      peersRef.current[sid].close();
      delete peersRef.current[sid];
    }
    const pc = new RTCPeerConnection(ICE);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('ice-candidate', { to: sid, from: socket.id, candidate });
      }
    };

    const remoteStream = new MediaStream();
    pc.ontrack = ({ track }) => {
      remoteStream.addTrack(track);
      setPeers((prev) => {
        const ex = prev.find((p) => p.socketId === sid);
        if (ex) return prev.map((p) => p.socketId === sid ? { ...p, stream: remoteStream } : p);
        return [...prev, { socketId: sid, userName: remoteUserName, stream: remoteStream }];
      });
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removePeer(sid);
      }
    };

    peersRef.current[sid] = pc;
    return pc;
  }, [socket, removePeer]);

  useEffect(() => {
    if (!socket) return;

    const handleExistingPeers = async (existingPeers) => {
      for (const peer of existingPeers) {
        const pc = createPeerConnection(peer.socketId, peer.userName);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: peer.socketId, from: socket.id, offer, userName });
        } catch (e) { console.warn('offer error', e); }
      }
    };

    const handleUserJoined = ({ socketId, userName: rName }) => {
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, userName: rName, stream: null }];
      });
    };

    const handleOffer = async ({ from, offer, userName: rName }) => {
      let pc = peersRef.current[from];
      if (!pc || pc.signalingState === 'closed') {
        pc = createPeerConnection(from, rName);
      }
      try {
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, from: socket.id, answer });
      } catch (e) { console.warn('answer error', e); }
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (!pc || pc.signalingState !== 'have-local-offer') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) { console.warn('setRemoteDescription error', e); }
    };

    const handleIce = async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (!pc || !candidate) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    const handleUserLeft    = ({ socketId }) => removePeer(socketId);
    const handleKicked      = () => window.dispatchEvent(new Event('qm-kicked'));

    socket.on('existing-peers',  handleExistingPeers);
    socket.on('user-joined',     handleUserJoined);
    socket.on('offer',           handleOffer);
    socket.on('answer',          handleAnswer);
    socket.on('ice-candidate',   handleIce);
    socket.on('user-left',       handleUserLeft);
    socket.on('kicked',          handleKicked);

    return () => {
      socket.off('existing-peers',  handleExistingPeers);
      socket.off('user-joined',     handleUserJoined);
      socket.off('offer',           handleOffer);
      socket.off('answer',          handleAnswer);
      socket.off('ice-candidate',   handleIce);
      socket.off('user-left',       handleUserLeft);
      socket.off('kicked',          handleKicked);
    };
  }, [socket, createPeerConnection, removePeer, userName]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = enabled; });
    setAudioEnabled(enabled);
    if (socket) socket.emit('toggle-audio', { roomId, userId, enabled });
  }, [audioEnabled, socket, roomId, userId]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = enabled; });
    setVideoEnabled(enabled);
    if (socket) socket.emit('toggle-video', { roomId, userId, enabled });
  }, [videoEnabled, socket, roomId, userId]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      // ── Stop screen share ──────────────────────────────────────────────────
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);

      // Restore camera video track to all peer connections
      const camTrack = camStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        });
      }

      setScreenSharing(false);
      // localStream already points to the camera stream — no change needed
    } else {
      try {
        // ── Start screen share ─────────────────────────────────────────────
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = ss;
        const screenTrack = ss.getVideoTracks()[0];

        // Send the screen track to all connected peers (replaces video sender)
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        // Expose the screen stream so Room.js can show it as a separate tile
        setScreenStream(ss);
        setScreenSharing(true);

        // When the user stops sharing via browser UI, clean up
        screenTrack.onended = () => {
          screenStreamRef.current?.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
          setScreenStream(null);
          setScreenSharing(false);

          // Restore camera video track to peers
          const camTrack = camStreamRef.current?.getVideoTracks()[0];
          if (camTrack) {
            Object.values(peersRef.current).forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) sender.replaceTrack(camTrack);
            });
          }
        };

        // localStream keeps pointing to camera — user can still see themselves
      } catch (e) {
        console.error('Screen share failed:', e);
      }
    }
  }, [screenSharing]);

  const cleanup = useCallback(() => {
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setPeers([]);
    setLocalStream(null);
    setScreenStream(null);
  }, []);

  return {
    localStream, screenStream, peers, audioEnabled, videoEnabled, screenSharing,
    initLocalStream, toggleAudio, toggleVideo, toggleScreenShare, cleanup,
  };
};