'use client';

import { useRef, useEffect } from 'react';
import { Participant } from '@/types';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoGridProps {
    localStream: MediaStream | null;
    participants: Map<string, Participant>;
    isLocalAudioEnabled: boolean;
    isLocalVideoEnabled: boolean;
}

export default function VideoGrid({
    localStream,
    participants,
    isLocalAudioEnabled,
    isLocalVideoEnabled
}: VideoGridProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {/* Local Video */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 rounded-full text-white text-sm">
                    You
                </div>
                <div className="absolute bottom-2 right-2 flex space-x-2">
                    {!isLocalAudioEnabled && (
                        <div className="bg-red-500 p-2 rounded-full">
                            <MicOff size={16} className="text-white" />
                        </div>
                    )}
                    {!isLocalVideoEnabled && (
                        <div className="bg-red-500 p-2 rounded-full">
                            <VideoOff size={16} className="text-white" />
                        </div>
                    )}
                </div>
            </div>

            {/* Remote Videos */}
            {Array.from(participants.values()).map((participant) => (
                <RemoteVideo key={participant.socketId} participant={participant} />
            ))}
        </div>
    );
}

function RemoteVideo({ participant }: { participant: Participant }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    return (
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 rounded-full text-white text-sm">
                {participant.username}
            </div>
            <div className="absolute bottom-2 right-2 flex space-x-2">
                {!participant.isAudioEnabled && (
                    <div className="bg-red-500 p-2 rounded-full">
                        <MicOff size={16} className="text-white" />
                    </div>
                )}
                {!participant.isVideoEnabled && (
                    <div className="bg-red-500 p-2 rounded-full">
                        <VideoOff size={16} className="text-white" />
                    </div>
                )}
            </div>
        </div>
    );
}
