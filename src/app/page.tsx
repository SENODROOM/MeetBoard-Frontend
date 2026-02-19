'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

export default function Home() {
    const router = useRouter();
    const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, isLoading]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-6xl font-bold text-gray-900 mb-4">
                        Meet Board
                    </h1>
                    <p className="text-2xl text-gray-600 mb-8">
                        Real-Time Communication Platform
                    </p>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                        Connect with your team through video calls, share your screen,
                        collaborate on a whiteboard, and chat in real-time.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-16">
                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="text-4xl mb-4">🎥</div>
                        <h3 className="text-xl font-semibold mb-2">Video Calling</h3>
                        <p className="text-gray-600">
                            High-quality video and audio calls with multiple participants
                        </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="text-4xl mb-4">🖥️</div>
                        <h3 className="text-xl font-semibold mb-2">Screen Sharing</h3>
                        <p className="text-gray-600">
                            Share your screen with participants for presentations
                        </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="text-4xl mb-4">🎨</div>
                        <h3 className="text-xl font-semibold mb-2">Whiteboard</h3>
                        <p className="text-gray-600">
                            Collaborate in real-time with an interactive whiteboard
                        </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="text-4xl mb-4">💬</div>
                        <h3 className="text-xl font-semibold mb-2">Real-Time Chat</h3>
                        <p className="text-gray-600">
                            Send messages and share files instantly with your team
                        </p>
                    </div>
                </div>

                <div className="text-center space-x-4">
                    <Link
                        href="/login"
                        className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        Login
                    </Link>
                    <Link
                        href="/register"
                        className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition"
                    >
                        Sign Up
                    </Link>
                </div>
            </div>
        </main>
    );
}
