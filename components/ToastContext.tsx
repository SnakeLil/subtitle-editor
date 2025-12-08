import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastState {
  open: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

interface ToastContextValue {
  toast: (options: string | ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const defaultToastState: ToastState = {
  open: false,
  message: '',
  type: 'info',
  duration: 6000,
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toastState, setToastState] = useState<ToastState>(defaultToastState);

  const toast = useCallback((options: string | ToastOptions) => {
    if (typeof options === 'string') {
      setToastState({
        ...defaultToastState,
        open: true,
        message: options,
      });
    } else {
      setToastState({
        open: true,
        message: options.message,
        type: options.type || 'info',
        duration: options.duration || 6000,
      });
    }
  }, []);

  const success = useCallback((message: string) => {
    toast({ message, type: 'success' });
  }, [toast]);

  const error = useCallback((message: string) => {
    toast({ message, type: 'error' });
  }, [toast]);

  const warning = useCallback((message: string) => {
    toast({ message, type: 'warning' });
  }, [toast]);

  const info = useCallback((message: string) => {
    toast({ message, type: 'info' });
  }, [toast]);

  const handleClose = useCallback(() => {
    setToastState((prev) => ({ ...prev, open: false }));
  }, []);

  const getTypeStyles = (type: string) => {
    const baseStyles = 'border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 max-w-md';
    switch (type) {
      case 'error':
        return `${baseStyles} bg-black border-red-500/30 text-white shadow-red-500/10`;
      case 'success':
        return `${baseStyles} bg-black border-[#C5A26E]/30 text-white shadow-[#C5A26E]/10`;
      case 'warning':
        return `${baseStyles} bg-black border-orange-500/30 text-white shadow-orange-500/10`;
      case 'info':
      default:
        return `${baseStyles} bg-black border-blue-500/30 text-white shadow-blue-500/10`;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'error':
        return '#FF5252';
      case 'success':
        return '#C5A26E';
      case 'warning':
        return '#FFA726';
      case 'info':
      default:
        return '#C5A26E';
    }
  };

  const value: ToastContextValue = {
    toast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastState.open && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-[slideDown_0.3s_ease-out]">
          <div className={getTypeStyles(toastState.type)}>
            <div className="flex-shrink-0 pt-0.5">
              <svg width="20" height="20" viewBox="0 0 20 20" fill={getIconColor(toastState.type)}>
                {toastState.type === 'success' && (
                  <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z" />
                )}
                {toastState.type === 'error' && (
                  <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z" />
                )}
                {toastState.type === 'warning' && (
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                )}
                {toastState.type === 'info' && (
                  <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-6h2v6zm0-8H9V5h2v2z" />
                )}
              </svg>
            </div>
            <div className="flex-1 font-['IBM_Plex_Sans']">{toastState.message}</div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 6.6L13.3 1.3c.4-.4 1-.4 1.4 0s.4 1 0 1.4L9.4 8l5.3 5.3c.4.4.4 1 0 1.4s-1 .4-1.4 0L8 9.4l-5.3 5.3c-.4.4-1 .4-1.4 0s-.4-1 0-1.4L6.6 8 1.3 2.7c-.4-.4-.4-1 0-1.4s1-.4 1.4 0L8 6.6z" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
