'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { roomAPI } from '@/services/api';
import { Room } from '@/types';
import Link from 'next/link';

export default function DashboardPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuthStore();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        } else if (isAuthenticated) {
            loadRooms();
        }
    }, [isAuthenticated, isLoading]);

    const loadRooms = async () => {
        try {
            const response = await roomAPI.listRooms();
            setRooms(response.rooms);
        } catch (error) {
            console.error('Failed to load rooms:', error);
        }
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            const response = await roomAPI.createRoom(roomName);
            router.push(`/room/${response.room.id}`);
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room');
        } finally {
            setCreating(false);
        }
    };

    const handleJoinRoom = async (roomId: string) => {
        try {
            await roomAPI.joinRoom(roomId);
            router.push(`/room/${roomId}`);
        } catch (error) {
            console.error('Failed to join room:', error);
            alert('Failed to join room');
        }
    };

    const handleLogout = async () => {
        await logout();
        router.push('/');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Meet Board</h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-700">Welcome, {user?.username}!</span>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="mb-8 flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-gray-900">Available Rooms</h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        + Create Room
                    </button>
                </div>

                {/* Rooms Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rooms.map((room) => (
                        <div key={room.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">{room.name}</h3>
                            <div className="text-sm text-gray-600 mb-4">
                                <p>Created by: {room.creator_username}</p>
                                <p>Participants: {room.participant_count || 0} / {room.max_participants}</p>
                                <p>Type: {room.room_type}</p>
                            </div>
                            <button
                                onClick={() => handleJoinRoom(room.id)}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                            >
                                Join Room
                            </button>
                        </div>
                    ))}
                </div>

                {rooms.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-gray-500 text-lg mb-4">No rooms available</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            Create the first room
                        </button>
                    </div>
                )}
            </main>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Room</h2>
                        <form onSubmit={handleCreateRoom}>
                            <div className="mb-4">
                                <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Room Name
                                </label>
                                <input
                                    id="roomName"
                                    type="text"
                                    required
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="My Meeting Room"
                                />
                            </div>
                            <div className="flex space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
