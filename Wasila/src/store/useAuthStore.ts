import { create } from 'zustand';

export type UserRole = 'customer' | 'provider';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  isAvailable?: boolean;
}

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  
  setUser: (user: UserProfile | null) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, // Start with null for real auth
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),
  updateUser: (data) => set((state) => ({ 
    user: state.user ? { ...state.user, ...data } : null 
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, isLoading: false }),
}));
