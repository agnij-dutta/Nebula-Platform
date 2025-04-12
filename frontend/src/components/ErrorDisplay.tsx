import React from 'react';
import './ErrorDisplay.css';

export interface ErrorDisplayProps {
    message: string;
    onRetry?: () => void;
    isRetrying?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry, isRetrying }) => {
    return (
        <div className="error-display">
            <div className="error-content">
                <i className="error-icon">⚠️</i>
                <p>{message}</p>
                {onRetry && (
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