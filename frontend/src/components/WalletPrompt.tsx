import React, { useState, useEffect, useCallback } from 'react';
import { WEB3_CONFIG } from '../web3/config';
import './WalletPrompt.css';

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on: (eventName: string, handler: (...args: any[]) => void) => void;
            removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
        };
    }
}

interface WalletPromptProps {
    message?: string;
    onConnect: () => Promise<void>;
    isNetworkSwitching?: boolean;
    isLoading?: boolean;
}

const WalletPrompt: React.FC<WalletPromptProps> = ({ 
    message = "To interact with the Nebula Platform, please connect your wallet",
    onConnect,
    isNetworkSwitching = false,
    isLoading = false
}) => {
    const [error, setError] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);
    
    // Combined loading state
    const isInProgress = isLoading || isNetworkSwitching || isConnecting;

    // Reset connecting state if loading state changes
    useEffect(() => {
        if (!isLoading && !isNetworkSwitching && isConnecting) {
            setIsConnecting(false);
        }
    }, [isLoading, isNetworkSwitching, isConnecting]);

    const handleConnect = useCallback(async () => {
        if (isInProgress) {
            return;
        }
        
        setError('');
        setIsConnecting(true);
        
        try {
            if (!window.ethereum?.isMetaMask) {
                throw new Error('MetaMask is not installed');
            }

            await onConnect();
        } catch (err: any) {
            console.error('Connection error:', err);
            
            if (err.message?.includes('already pending') || err.message?.includes('already in progress')) {
                setError('Please check MetaMask for pending connection requests');
                // Keep the connecting state while there's a pending request
                return;
            } else {
                setError(err.message || 'Failed to connect wallet. Please try again.');
            }
        } finally {
            // Only reset connecting state if there's no pending request error
            if (!error?.includes('already pending') && !error?.includes('already in progress')) {
                setIsConnecting(false);
            }
        }
    }, [isInProgress, onConnect, error]);

    // Add effect to reset error state
    useEffect(() => {
        let errorTimeout: NodeJS.Timeout;
        if (error && (error.includes('already pending') || error.includes('already in progress'))) {
            errorTimeout = setTimeout(() => {
                setError('');
                setIsConnecting(false);
            }, 5000);
        }
        return () => {
            if (errorTimeout) {
                clearTimeout(errorTimeout);
            }
        };
    }, [error]);

    const openMetaMaskInstall = () => {
        window.open('https://metamask.io/download.html', '_blank');
    };

    const isMetaMaskInstalled = typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;

    return (
        <div className="wallet-prompt">
            <div className="wallet-prompt-content">
                <div className={`wallet-icon-wrapper ${isInProgress ? 'spin' : ''}`}>
                    <img 
                        src="/metamask.svg" 
                        alt="MetaMask" 
                        className="wallet-icon"
                    />
                </div>
                
                <h3>{message}</h3>
                
                {error && (
                    <div className="error-message">
                        {error}
                        {!isMetaMaskInstalled && (
                            <button onClick={openMetaMaskInstall} className="install-button">
                                Install MetaMask
                            </button>
                        )}
                    </div>
                )}
                
                <button 
                    onClick={handleConnect} 
                    className={`connect-button ${isInProgress ? 'loading' : ''}`}
                    disabled={isInProgress || !isMetaMaskInstalled}
                >
                    {isNetworkSwitching 
                        ? 'Switching Network...'
                        : isLoading || isConnecting
                            ? 'Connecting...'
                            : isMetaMaskInstalled 
                                ? 'Connect Wallet'
                                : 'Install MetaMask'}
                </button>

                <div className="network-info">
                    <div className="title">Required Network</div>
                    <div className="network-name">{WEB3_CONFIG.NETWORKS.TESTNET.name}</div>
                </div>
            </div>
        </div>
    );
};

export default WalletPrompt;