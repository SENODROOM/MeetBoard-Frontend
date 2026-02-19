import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Auth API
export const authAPI = {
    register: async (email: string, username: string, password: string) => {
        const response = await api.post('/auth/register', { email, username, password });
        return response.data;
    },

    login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },

    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    },

    getProfile: async () => {
        const response = await api.get('/auth/profile');
        return response.data;
    },

    refreshToken: async () => {
        const response = await api.post('/auth/refresh');
        return response.data;
    },
};

// Room API
export const roomAPI = {
    createRoom: async (name: string, roomType = 'public', maxParticipants = 50) => {
        const response = await api.post('/rooms', { name, roomType, maxParticipants });
        return response.data;
    },

    listRooms: async (type = 'public', limit = 20, offset = 0) => {
        const response = await api.get('/rooms', { params: { type, limit, offset } });
        return response.data;
    },

    getRoom: async (roomId: string) => {
        const response = await api.get(`/rooms/${roomId}`);
        return response.data;
    },

    joinRoom: async (roomId: string) => {
        const response = await api.post(`/rooms/${roomId}/join`);
        return response.data;
    },

    leaveRoom: async (roomId: string) => {
        const response = await api.post(`/rooms/${roomId}/leave`);
        return response.data;
    },

    endRoom: async (roomId: string) => {
        const response = await api.post(`/rooms/${roomId}/end`);
        return response.data;
    },
};

// Chat API
export const chatAPI = {
    getChatHistory: async (roomId: string, limit = 50, before?: string) => {
        const response = await api.get(`/chat/${roomId}/history`, { params: { limit, before } });
        return response.data;
    },

    deleteMessage: async (messageId: string) => {
        const response = await api.delete(`/chat/messages/${messageId}`);
        return response.data;
    },

    editMessage: async (messageId: string, message: string) => {
        const response = await api.put(`/chat/messages/${messageId}`, { message });
        return response.data;
    },
};

// File API
export const fileAPI = {
    uploadFile: async (roomId: string, file: File, iv: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', file.name);
        formData.append('iv', iv);
        formData.append('roomId', roomId);

        const response = await api.post('/files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getFileUrl: async (fileId: string) => {
        const response = await api.get(`/files/${fileId}/url`);
        return response.data;
    },

    listRoomFiles: async (roomId: string) => {
        const response = await api.get(`/files/room/${roomId}`);
        return response.data;
    },

    deleteFile: async (fileId: string) => {
        const response = await api.delete(`/files/${fileId}`);
        return response.data;
    },
};

export default api;
