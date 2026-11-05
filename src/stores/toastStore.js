import { create } from 'zustand';

let toastCounter = 0;

export const useToastStore = create((set, get) => ({
    toasts: [],

    addToast: (message, type = 'info', duration = 4000, action = null) => {
        const id = `toast-${++toastCounter}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const toast = { id, message, type, action };

        set(state => ({
            toasts: [...state.toasts, toast]
        }));

        if (duration > 0) {
            setTimeout(() => {
                get().removeToast(id);
            }, duration);
        }

        return id;
    },

    removeToast: (id) => {
        set(state => ({
            toasts: state.toasts.filter(t => t.id !== id)
        }));
    },

    success: (message, duration, action) => get().addToast(message, 'success', duration, action),
    error: (message, duration, action) => get().addToast(message, 'error', duration, action),
    warning: (message, duration) => get().addToast(message, 'warning', duration),
    info: (message, duration, action) => get().addToast(message, 'info', duration, action),
}));
