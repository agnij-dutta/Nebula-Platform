import React from 'react';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
    message: string;
    onRetry?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => {
    return (
        <div className="error-display">
            <div className="error-content">
                <i className="error-icon">⚠️</i>
                <p>{message}</p>
                {onRetry && (
                    <button onClick={onRetry} className="retry-button">
                        Try Again
                    </button>
                )}
            </div>
        </div>
    );
};

export default ErrorDisplay;