export interface User {
    id: string;
    email: string;
    username: string;
}

export interface Room {
    id: string;
    name: string;
    room_type: 'public' | 'private' | 'scheduled';
    max_participants: number;
    created_at: string;
    creator_username: string;
    participant_count?: number;
}

export interface Participant {
    socketId: string;
    userId: string;
    username: string;
    stream?: MediaStream;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
}

export interface ChatMessage {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    message: string;
    messageType: 'text' | 'file' | 'system';
    timestamp: string;
    editedAt?: string;
    isDeleted: boolean;
    replyTo?: string;
}

export interface FileInfo {
    id: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
    uploaded_by_username: string;
}
