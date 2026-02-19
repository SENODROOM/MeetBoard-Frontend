'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { Send } from 'lucide-react';

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onStartTyping: () => void;
    onStopTyping: () => void;
    isTyping: string[];
}

export default function Chat({
    messages,
    onSendMessage,
    onStartTyping,
    onStopTyping,
    isTyping
}: ChatProps) {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);

        onStartTyping();

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            onStopTyping();
        }, 1000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            onSendMessage(message);
            setMessage('');
            onStopTyping();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col">
                        <div className="flex items-baseline space-x-2">
                            <span className="font-semibold text-sm text-blue-600">{msg.username}</span>
                            <span className="text-xs text-gray-500">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="text-gray-800">{msg.message}</div>
                    </div>
                ))}

                {isTyping.length > 0 && (
                    <div className="text-sm text-gray-500 italic">
                        {isTyping.join(', ')} {isTyping.length === 1 ? 'is' : 'are'} typing...
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={message}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </form>
        </div>
    );
}
