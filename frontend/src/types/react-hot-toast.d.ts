declare module 'react-hot-toast' {
    type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    
    interface ToastOptions {
        position?: ToastPosition;
        duration?: number;
        style?: React.CSSProperties;
        className?: string;
        icon?: React.ReactNode;
        id?: string;
    }

    interface Toast {
        id: string;
        visible: boolean;
        message: string | React.ReactNode;
        type: 'success' | 'error' | 'loading' | 'blank' | 'custom';
    }

    interface ToasterProps {
        position?: ToastPosition;
        toastOptions?: ToastOptions;
        reverseOrder?: boolean;
        gutter?: number;
        containerStyle?: React.CSSProperties;
        containerClassName?: string;
    }

    export const toast: {
        (message: string | React.ReactNode, options?: ToastOptions): string;
        success(message: string | React.ReactNode, options?: ToastOptions): string;
        error(message: string | React.ReactNode, options?: ToastOptions): string;
        loading(message: string | React.ReactNode, options?: ToastOptions): string;
        dismiss(toastId?: string): void;
        remove(toastId?: string): void;
    };

    export function Toaster(props: ToasterProps): JSX.Element;
    export function useToaster(): {
        toasts: Toast[];
        handlers: {
            startPause: () => void;
            endPause: () => void;
            updateHeight: (toastId: string, height: number) => void;
            calculateOffset: (toast: Toast, opts?: { reverseOrder?: boolean; gutter?: number; defaultPosition?: ToastPosition }) => number;
        };
    };
} 