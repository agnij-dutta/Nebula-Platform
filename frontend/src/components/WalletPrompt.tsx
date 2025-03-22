import React, { useState, useEffect, useCallback } from 'react';
import { WEB3_CONFIG } from '../web3/config';
import './WalletPrompt.css';

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
    const isMetaMaskInstalled = typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;

    useEffect(() => {
        if (!isLoading && !isNetworkSwitching && isConnecting) {
            setIsConnecting(false);
        }
    }, [isLoading, isNetworkSwitching, isConnecting]);

    const openMetaMaskInstall = () => {
        window.open('https://metamask.io/download.html', '_blank');
    };

    const handleConnect = useCallback(async () => {
        if (!isMetaMaskInstalled) {
            openMetaMaskInstall();
            return;
        }

        if (isInProgress) {
            return;
        }
        
        setError('');
        setIsConnecting(true);
        
        try {
            await onConnect();
        } catch (err: any) {
            console.error('Connection error:', err);
            
            if (err.message?.includes('already pending') || err.message?.includes('already in progress')) {
                setError('Please check MetaMask for pending connection requests');
                return;
            } else if (err.message?.includes('rejected')) {
                setError('Connection rejected. Please try again.');
            } else {
                setError(err.message || 'Failed to connect wallet. Please try again.');
            }
        } finally {
            if (!error?.includes('already pending') && !error?.includes('already in progress')) {
                setIsConnecting(false);
            }
        }
    }, [isInProgress, onConnect, error, isMetaMaskInstalled]);

    // Reset error after 5 seconds for pending requests
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
                
                {!isMetaMaskInstalled && (
                    <div className="install-prompt">
                        <p>MetaMask is required to use the Nebula Platform</p>
                        <p className="install-description">
                            MetaMask is a secure wallet that helps you interact with Web3 applications.
                        </p>
                    </div>
                )}
                
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}
                
                <button 
                    onClick={handleConnect} 
                    className={`connect-button ${isInProgress ? 'loading' : ''}`}
                    disabled={isInProgress}
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
                    <div className="network-name">
                        {WEB3_CONFIG.NETWORKS.TESTNET.name}
                        <div className="network-details">
                            <div>Chain ID: {WEB3_CONFIG.NETWORKS.TESTNET.chainId}</div>
                            <div>Currency: {WEB3_CONFIG.NETWORKS.TESTNET.nativeCurrency.symbol}</div>
                            <div>RPC: {WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0]}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletPrompt;