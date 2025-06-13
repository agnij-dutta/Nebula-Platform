import React, { useEffect, useState, useCallback } from 'react';
import { WEB3_CONFIG } from '../web3/config';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import './NetworkValidator.css';

const AUTO_RETRY_INTERVAL = 5000;
const MAX_VALIDATION_ATTEMPTS = 3;
const RPC_TIMEOUT = 5000;

const NetworkValidator = () => {
    const { chainId, switchToFujiTestnet } = useWeb3Context();
    const [networkError, setNetworkError] = useState<string>('');
    const [rpcStatus, setRpcStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [isValidating, setIsValidating] = useState(false);
    const [validationAttempts, setValidationAttempts] = useState(0);
    const [showRpcRetry, setShowRpcRetry] = useState(false);

    const testConnection = useCallback(async (providerUrl: string): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT);

            const response = await fetch(providerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: Date.now()
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`RPC endpoint ${providerUrl} returned status ${response.status}`);
                return false;
            }

            const data = await response.json();
            if (data.error) {
                console.warn(`RPC endpoint ${providerUrl} error:`, data.error);
                return false;
            }

            return !!data.result;
        } catch (err) {
            console.warn(`RPC endpoint ${providerUrl} failed:`, err);
            return false;
        }
    }, []);

    const validateNetwork = useCallback(async () => {
        if (isValidating || validationAttempts >= MAX_VALIDATION_ATTEMPTS) {
            return;
        }

        setIsValidating(true);
        setShowRpcRetry(false);

        try {
            // Check chain ID first
            if (chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                setNetworkError('Please switch to Avalanche Fuji Testnet');
                try {
                    await switchToFujiTestnet();
                    setValidationAttempts(0);
                } catch (err) {
                    console.error('Network switch failed:', err);
                    setValidationAttempts(prev => prev + 1);
                    setRpcStatus('error');
                    return;
                }
            }

            // Use Avalanche Fuji RPC URLs
            const rpcUrls = WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl;

            let connected = false;

            // Test first RPC endpoint
            if (await testConnection(rpcUrls[0])) {
                connected = true;
            } else {
                // Test remaining RPCs in parallel
                const results = await Promise.all(
                    rpcUrls.slice(1).map(url => testConnection(url))
                );

                connected = results.some(success => success);
            }

            if (connected) {
                setRpcStatus('connected');
                setNetworkError('');
                setValidationAttempts(0);
            } else {
                throw new Error('All RPC endpoints failed');
            }

        } catch (err) {
            console.error('Network validation failed:', err);
            setNetworkError('Network connection is unstable');
            setRpcStatus('error');
            setValidationAttempts(prev => prev + 1);

            if (validationAttempts < MAX_VALIDATION_ATTEMPTS - 1) {
                setTimeout(() => {
                    setIsValidating(false);
                }, AUTO_RETRY_INTERVAL);
            } else {
                setNetworkError('Network connection failed');
                setShowRpcRetry(true);
            }
        } finally {
            setIsValidating(false);
        }
    }, [chainId, switchToFujiTestnet, isValidating, validationAttempts, testConnection]);

    useEffect(() => {
        validateNetwork();
    }, [validateNetwork]);

    useEffect(() => {
        if (rpcStatus === 'error' && validationAttempts >= MAX_VALIDATION_ATTEMPTS) {
            const resetTimer = setTimeout(() => {
                setValidationAttempts(0);
                setIsValidating(false);
            }, 30000);

            return () => clearTimeout(resetTimer);
        }
    }, [rpcStatus, validationAttempts]);

    if (networkError && rpcStatus === 'error') {
        return (
            <div className="network-error-container">
                <div className="network-error-content">
                    <div className="network-error-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <div className="network-error-message">
                        <h3>Network Connection Issue</h3>
                        <p>{networkError}</p>
                        {isValidating && (
                            <div className="network-retry-progress">
                                <div className="retry-spinner"></div>
                                <span>Retrying connection...</span>
                            </div>
                        )}
                        {showRpcRetry && (
                            <button
                                onClick={() => {
                                    setValidationAttempts(0);
                                    setIsValidating(false);
                                    validateNetwork();
                                }}
                                className="retry-button"
                            >
                                Retry Connection
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default NetworkValidator;