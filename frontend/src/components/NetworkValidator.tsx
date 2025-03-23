import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { WEB3_CONFIG } from '../web3/config';
import './NetworkSwitchOverlay.css';

const NetworkValidator: React.FC = () => {
    const { provider, chainId, error: web3Error, switchToFujiTestnet } = useWeb3();
    const [isValidating, setIsValidating] = useState(false);
    const [validationAttempts, setValidationAttempts] = useState(0);
    const [networkError, setNetworkError] = useState('');
    const [rpcStatus, setRpcStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const MAX_AUTO_SWITCH_ATTEMPTS = 5;
    const AUTO_RETRY_INTERVAL = 5000;

    useEffect(() => {
        const validateNetwork = async () => {
            if (!provider || isValidating) return;
            
            try {
                setIsValidating(true);
                setRpcStatus('connecting');
                
                const network = await provider.getNetwork();
                const currentDomain = window.location.hostname;
                
                // Check if current domain is allowed
                const isAllowedDomain = WEB3_CONFIG.CONNECTION_CONFIG.allowedDomains.some(domain => 
                    currentDomain === domain || currentDomain.endsWith(`.${domain}`)
                );

                if (!isAllowedDomain) {
                    setNetworkError('Access restricted to authorized domains only');
                    return;
                }

                // Check if we're on the correct network
                if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                    if (validationAttempts < MAX_AUTO_SWITCH_ATTEMPTS) {
                        try {
                            await switchToFujiTestnet();
                            setValidationAttempts(prev => prev + 1);
                        } catch (err: any) {
                            console.error('Network switch failed:', err);
                            setNetworkError(err.message || 'Failed to switch network');
                            setRpcStatus('error');
                            
                            // Schedule retry
                            setTimeout(() => {
                                setIsValidating(false);
                            }, AUTO_RETRY_INTERVAL);
                            return;
                        }
                    } else {
                        setNetworkError(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
                        setRpcStatus('error');
                        return;
                    }
                }

                // Test RPC connection
                try {
                    await provider.getBlockNumber();
                    setRpcStatus('connected');
                    setNetworkError('');
                } catch (err) {
                    console.error('RPC connection failed:', err);
                    setNetworkError('Network connection unstable. Retrying...');
                    setRpcStatus('error');
                    
                    // Schedule retry
                    setTimeout(() => {
                        setIsValidating(false);
                    }, AUTO_RETRY_INTERVAL);
                    return;
                }

            } catch (err) {
                console.error('Network validation failed:', err);
                setNetworkError('Failed to validate network connection');
                setRpcStatus('error');
            } finally {
                setIsValidating(false);
            }
        };

        validateNetwork();
    }, [provider, chainId, switchToFujiTestnet, isValidating, validationAttempts]);

    // Reset validation attempts when network is correct
    useEffect(() => {
        if (chainId === WEB3_CONFIG.NETWORKS.TESTNET.chainId && rpcStatus === 'connected') {
            setValidationAttempts(0);
            setNetworkError('');
        }
    }, [chainId, rpcStatus]);

    if (web3Error || networkError) {
        return (
            <div className={`network-error-banner ${rpcStatus}`}>
                <div className="error-content">
                    <span className="error-icon">⚠️</span>
                    <span className="error-message">
                        {web3Error || networkError}
                    </span>
                    {rpcStatus === 'error' && (
                        <div className="connection-status">
                            Attempting to reconnect...
                            <div className="loading-dots">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                            </div>
                        </div>
                    )}
                </div>
                {validationAttempts >= MAX_AUTO_SWITCH_ATTEMPTS && (
                    <button 
                        className="retry-button"
                        onClick={() => {
                            setValidationAttempts(0);
                            setIsValidating(false);
                        }}
                    >
                        Retry Connection
                    </button>
                )}
            </div>
        );
    }

    return null;
};

export default NetworkValidator;