import React from 'react';
import './ErrorDisplay.css';

export interface ErrorDisplayProps {
    message: string;
    onRetry?: () => void;
    isRetrying?: boolean;
    type?: 'error' | 'success';
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry, isRetrying, type = 'error' }) => {
    const isSuccess = type === 'success';

    return (
        <div className={`error-display ${isSuccess ? 'success-display' : ''}`}>
            <div className="error-content">
                <i className="error-icon">{isSuccess ? '✅' : '⚠️'}</i>
                <p>{message}</p>
                {onRetry && !isSuccess && (
                    <button
                        onClick={onRetry}
                        className={`retry-button ${isRetrying ? 'retrying' : ''}`}
                        disabled={isRetrying}
                    >
                        {isRetrying ? 'Retrying...' : 'Try Again'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ErrorDisplay;