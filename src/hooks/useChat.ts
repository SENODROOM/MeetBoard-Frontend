import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '@/types';
import { chatAPI } from '@/services/api';

export function useChat(roomId: string, token: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState<string[]>([]);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        loadChatHistory();
        connectSocket();

        return () => {
            socketRef.current?.disconnect();
        };
    }, [roomId]);

    const loadChatHistory = async () => {
        try {
            const response = await chatAPI.getChatHistory(roomId);
            setMessages(response.messages);
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    };

    const connectSocket = () => {
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        const socket = io(WS_URL, {
            auth: { token },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', { roomId });
        });

        socket.on('chat-message', (message: ChatMessage) => {
            setMessages(prev => [...prev, message]);
        });

        socket.on('user-typing', ({ username }) => {
            setIsTyping(prev => [...prev, username]);
        });

        socket.on('user-stopped-typing', ({ userId }) => {
            setIsTyping(prev => prev.filter(u => u !== userId));
        });
    };

    const sendMessage = (message: string, messageType = 'text', replyTo?: string) => {
        socketRef.current?.emit('chat-message', {
            roomId,
            message,
            messageType,
            replyTo,
        });
    };

    const startTyping = () => {
        socketRef.current?.emit('typing-start', { roomId });
    };

    const stopTyping = () => {
        socketRef.current?.emit('typing-stop', { roomId });
    };

    return {
        messages,
        isTyping,
        sendMessage,
        startTyping,
        stopTyping,
    };
}
