'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useChat } from '@/hooks/useChat';
import VideoGrid from '@/components/VideoGrid';
import Chat from '@/components/Chat';
import Whiteboard from '@/components/Whiteboard';
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, Palette, PhoneOff } from 'lucide-react';
import { roomAPI } from '@/services/api';

export default function RoomPage() {
    const router = useRouter();
    const params = useParams();
    const roomId = params.roomId as string;

    const { user, isAuthenticated, checkAuth } = useAuthStore();
    const [token, setToken] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard'>('chat');
    const [roomName, setRoomName] = useState('');

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (isAuthenticated && user) {
            // In a real app, you'd get the token from cookies or auth state
            // For now, we'll use a placeholder
            setToken('user-token');
            loadRoomInfo();
        } else if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, user]);

    const loadRoomInfo = async () => {
        try {
            const response = await roomAPI.getRoom(roomId);
            setRoomName(response.room.name);
        } catch (error) {
            console.error('Failed to load room:', error);
        }
    };

    const {
        localStream,
        participants,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
    } = useWebRTC(roomId, token);

    const {
        messages,
        isTyping,
        sendMessage,
        startTyping,
        stopTyping,
    } = useChat(roomId, token);

    const handleLeaveRoom = async () => {
        try {
            await roomAPI.leaveRoom(roomId);
            router.push('/dashboard');
        } catch (error) {
            console.error('Failed to leave room:', error);
            router.push('/dashboard');
        }
    };

    if (!isAuthenticated || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-900">
            {/* Header */}
            <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">{roomName || 'Meeting Room'}</h1>
                    <p className="text-sm text-gray-400">
                        {participants.size + 1} participant{participants.size !== 0 ? 's' : ''}
                    </p>
                </div>

                <button
                    onClick={handleLeaveRoom}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                    <PhoneOff size={20} />
                    <span>Leave</span>
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video Area */}
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-auto">
                        <VideoGrid
                            localStream={localStream}
                            participants={participants}
                            isLocalAudioEnabled={isAudioEnabled}
                            isLocalVideoEnabled={isVideoEnabled}
                        />
                    </div>

                    {/* Controls */}
                    <div className="bg-gray-800 p-4 flex justify-center space-x-4">
                        <button
                            onClick={toggleAudio}
                            className={`p-4 rounded-full ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            title={isAudioEnabled ? 'Mute' : 'Unmute'}
                        >
                            {isAudioEnabled ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-white" />}
                        </button>

                        <button
                            onClick={toggleVideo}
                            className={`p-4 rounded-full ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
                        >
                            {isVideoEnabled ? <Video size={24} className="text-white" /> : <VideoOff size={24} className="text-white" />}
                        </button>

                        <button
                            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                            className={`p-4 rounded-full ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                            title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                        >
                            {isScreenSharing ? <MonitorOff size={24} className="text-white" /> : <Monitor size={24} className="text-white" />}
                        </button>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-96 bg-white flex flex-col">
                    {/* Tabs */}
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex-1 p-4 flex items-center justify-center space-x-2 ${activeTab === 'chat' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                                }`}
                        >
                            <MessageSquare size={20} />
                            <span>Chat</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('whiteboard')}
                            className={`flex-1 p-4 flex items-center justify-center space-x-2 ${activeTab === 'whiteboard' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                                }`}
                        >
                            <Palette size={20} />
                            <span>Whiteboard</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'chat' ? (
                            <Chat
                                messages={messages}
                                onSendMessage={sendMessage}
                                onStartTyping={startTyping}
                                onStopTyping={stopTyping}
                                isTyping={isTyping}
                            />
                        ) : (
                            <Whiteboard roomId={roomId} token={token} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
