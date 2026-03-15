import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ToastMessage {
    id: number;
    text: string;
    type: 'error' | 'success' | 'info';
}

let toastIdCounter = 0;

/** Dispatch a toast from anywhere (components, interceptors, etc.) */
export function showToast(message: string, type: 'error' | 'success' | 'info' = 'error') {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

export const Toast: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        const handleApiError = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const msg = detail?.message || 'An error occurred';
            const type = detail?.type || 'error';
            const id = ++toastIdCounter;
            setToasts(prev => [...prev.slice(-4), { id, text: msg, type }]);
            setTimeout(() => removeToast(id), 4000);
        };

        // Listen for both api-error (from interceptor) and app-toast (from components)
        window.addEventListener('api-error', handleApiError);
        window.addEventListener('app-toast', handleApiError);
        return () => {
            window.removeEventListener('api-error', handleApiError);
            window.removeEventListener('app-toast', handleApiError);
        };
    }, [removeToast]);

    if (toasts.length === 0) return null;

    const colorMap = {
        error: 'bg-red-600/90 border-red-500/50',
        success: 'bg-green-600/90 border-green-500/50',
        info: 'bg-blue-600/90 border-blue-500/50',
    };

    return (
        <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-white text-sm font-medium backdrop-blur-sm animate-slide-in ${colorMap[toast.type]}`}
                    style={{ animation: 'slideInRight 0.25s ease-out' }}
                >
                    <span className="flex-1">{toast.text}</span>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-white/70 hover:text-white transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
