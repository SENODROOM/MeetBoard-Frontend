import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Participant } from '@/types';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export function useWebRTC(roomId: string, token: string) {
    const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const screenStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        initializeMedia();
        connectSocket();

        return () => {
            cleanup();
        };
    }, [roomId]);

    const initializeMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setLocalStream(stream);
        } catch (error) {
            console.error('Failed to get media devices:', error);
        }
    };

    const connectSocket = () => {
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        const socket = io(WS_URL, {
            auth: { token },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket connected');
            socket.emit('join-room', { roomId });
        });

        socket.on('existing-participants', (existingParticipants: Participant[]) => {
            existingParticipants.forEach(participant => {
                createPeerConnection(participant.socketId, true);
            });
        });

        socket.on('participant-joined', (participant: Participant) => {
            setParticipants(prev => new Map(prev).set(participant.socketId, participant));
        });

        socket.on('offer', async ({ from, offer, participant }) => {
            setParticipants(prev => new Map(prev).set(from, participant));
            const pc = createPeerConnection(from, false);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { to: from, answer });
        });

        socket.on('answer', async ({ from, answer }) => {
            const pc = peerConnectionsRef.current.get(from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        socket.on('ice-candidate', async ({ from, candidate }) => {
            const pc = peerConnectionsRef.current.get(from);
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        socket.on('participant-left', ({ socketId }) => {
            closePeerConnection(socketId);
            setParticipants(prev => {
                const newMap = new Map(prev);
                newMap.delete(socketId);
                return newMap;
            });
        });

        socket.on('participant-media-changed', ({ socketId, type, enabled }) => {
            setParticipants(prev => {
                const newMap = new Map(prev);
                const participant = newMap.get(socketId);
                if (participant) {
                    if (type === 'audio') participant.isAudioEnabled = enabled;
                    if (type === 'video') participant.isVideoEnabled = enabled;
                    newMap.set(socketId, { ...participant });
                }
                return newMap;
            });
        });
    };

    const createPeerConnection = (socketId: string, isInitiator: boolean): RTCPeerConnection => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionsRef.current.set(socketId, pc);

        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        pc.ontrack = (event) => {
            setParticipants(prev => {
                const newMap = new Map(prev);
                const participant = newMap.get(socketId);
                if (participant) {
                    newMap.set(socketId, { ...participant, stream: event.streams[0] });
                }
                return newMap;
            });
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('ice-candidate', {
                    to: socketId,
                    candidate: event.candidate,
                });
            }
        };

        if (isInitiator) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socketRef.current?.emit('offer', {
                        to: socketId,
                        offer: pc.localDescription,
                    });
                });
        }

        return pc;
    };

    const closePeerConnection = (socketId: string) => {
        const pc = peerConnectionsRef.current.get(socketId);
        if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(socketId);
        }
    };

    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsAudioEnabled(audioTrack.enabled);
            socketRef.current?.emit('toggle-media', {
                roomId,
                type: 'audio',
                enabled: audioTrack.enabled,
            });
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoEnabled(videoTrack.enabled);
            socketRef.current?.emit('toggle-media', {
                roomId,
                type: 'video',
                enabled: videoTrack.enabled,
            });
        }
    };

    const startScreenShare = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' } as MediaTrackConstraints,
                audio: false,
            } as DisplayMediaStreamOptions);

            screenStreamRef.current = screenStream;
            const videoTrack = screenStream.getVideoTracks()[0];

            peerConnectionsRef.current.forEach((pc) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });

            videoTrack.onended = () => {
                stopScreenShare();
            };

            setIsScreenSharing(true);
            socketRef.current?.emit('start-screen-share', { roomId });
        } catch (error) {
            console.error('Failed to start screen share:', error);
        }
    };

    const stopScreenShare = async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }

        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            peerConnectionsRef.current.forEach((pc) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });
        }

        setIsScreenSharing(false);
        socketRef.current?.emit('stop-screen-share', { roomId });
    };

    const cleanup = () => {
        localStream?.getTracks().forEach(track => track.stop());
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        peerConnectionsRef.current.forEach(pc => pc.close());
        socketRef.current?.disconnect();
    };

    return {
        localStream,
        participants,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
    };
}
