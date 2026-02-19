import { create } from 'zustand';
import { User } from '@/types';
import { authAPI } from '@/services/api';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authAPI.login(email, password);
            set({ user: response.user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.error || 'Login failed',
                isLoading: false
            });
            throw error;
        }
    },

    register: async (email: string, username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            await authAPI.register(email, username, password);
            // Auto login after registration
            await authAPI.login(email, password);
            const profile = await authAPI.getProfile();
            set({ user: profile.user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.error || 'Registration failed',
                isLoading: false
            });
            throw error;
        }
    },

    logout: async () => {
        try {
            await authAPI.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            set({ user: null, isAuthenticated: false });
        }
    },

    checkAuth: async () => {
        set({ isLoading: true });
        try {
            const response = await authAPI.getProfile();
            set({ user: response.user, isAuthenticated: true, isLoading: false });
        } catch (error) {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    clearError: () => set({ error: null }),
}));
