import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTC = ({ socket, roomId, userId, userName }) => {
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const [peers, setPeers] = useState([]); // [{ socketId, userName, stream }]
  const [localStream, setLocalStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);

  // Init local media
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn('Camera/mic error:', err);
      // Try audio-only fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (e) {
        console.error('No media available');
        return null;
      }
    }
  }, []);

  const createPeerConnection = useCallback((socketId, remoteUserName) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('ice-candidate', { to: socketId, from: socket.id, candidate });
      }
    };

    // Remote stream
    const remoteStream = new MediaStream();
    pc.ontrack = ({ track }) => {
      remoteStream.addTrack(track);
      setPeers((prev) => {
        const existing = prev.find((p) => p.socketId === socketId);
        if (existing) {
          return prev.map((p) => p.socketId === socketId ? { ...p, stream: remoteStream } : p);
        }
        return [...prev, { socketId, userName: remoteUserName, stream: remoteStream }];
      });
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removePeer(socketId);
      }
    };

    peersRef.current[socketId] = pc;
    return pc;
  }, [socket]);

  const removePeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  // Socket signaling events
  useEffect(() => {
    if (!socket) return;

    const handleExistingPeers = async (peers) => {
      for (const peer of peers) {
        const pc = createPeerConnection(peer.socketId, peer.userName);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: peer.socketId, from: socket.id, offer, userName });
      }
    };

    const handleUserJoined = ({ socketId, userName: remoteUserName }) => {
      // The new user will send us an offer, just register
      setPeers((prev) => {
        if (!prev.find((p) => p.socketId === socketId)) {
          return [...prev, { socketId, userName: remoteUserName, stream: null }];
        }
        return prev;
      });
    };

    const handleOffer = async ({ from, offer, userName: remoteUserName }) => {
      const pc = createPeerConnection(from, remoteUserName);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, from: socket.id, answer });
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
      }
    };

    const handleUserLeft = ({ socketId }) => removePeer(socketId);

    socket.on('existing-peers', handleExistingPeers);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('existing-peers', handleExistingPeers);
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, createPeerConnection, removePeer, userName]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setAudioEnabled(enabled);
    if (socket) socket.emit('toggle-audio', { roomId, userId, enabled });
  }, [audioEnabled, socket, roomId, userId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setVideoEnabled(enabled);
    if (socket) socket.emit('toggle-video', { roomId, userId, enabled });
  }, [videoEnabled, socket, roomId, userId]);

  // Screen share
  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      // Stop screen share, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = camStream;
      setLocalStream(camStream);
      // Replace tracks in all peer connections
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camStream.getVideoTracks()[0]);
      });
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        // Replace video track in all peers
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        // Update local stream display
        const newStream = new MediaStream([
          screenTrack,
          ...(localStreamRef.current?.getAudioTracks() || []),
        ]);
        setLocalStream(newStream);
        screenTrack.onended = () => toggleScreenShare();
        setScreenSharing(true);
      } catch (e) {
        console.error('Screen share failed:', e);
      }
    }
  }, [screenSharing]);

  // Cleanup
  const cleanup = useCallback(() => {
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setPeers([]);
    setLocalStream(null);
  }, []);

  return {
    localStream,
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
