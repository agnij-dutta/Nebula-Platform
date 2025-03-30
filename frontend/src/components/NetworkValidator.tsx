import React, { useEffect, useState, useCallback } from 'react';
import { WEB3_CONFIG } from '../web3/config';
import { useWeb3 } from '../web3/hooks/useWeb3';

const AUTO_RETRY_INTERVAL = 3000;
const MAX_VALIDATION_ATTEMPTS = 3;
const RPC_TIMEOUT = 5000;

const NetworkValidator = () => {
    const { provider, chainId, switchToFujiTestnet } = useWeb3();
    const [networkError, setNetworkError] = useState<string>('');
    const [rpcStatus, setRpcStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [isValidating, setIsValidating] = useState(false);
    const [validationAttempts, setValidationAttempts] = useState(0);
    const [currentProvider, setCurrentProvider] = useState(0);

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
        if (!provider || isValidating || validationAttempts >= MAX_VALIDATION_ATTEMPTS) {
            return;
        }

        setIsValidating(true);

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

            // Try each RPC endpoint, starting with the official Avalanche RPC
            const rpcUrls = WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl;
            let connected = false;

            // Test official Avalanche RPC first
            if (await testConnection(rpcUrls[0])) {
                setCurrentProvider(0);
                connected = true;
            } else {
                // Test remaining RPCs in parallel
                const results = await Promise.all(
                    rpcUrls.slice(1).map((url, index) => 
                        testConnection(url)
                            .then(success => ({ index: index + 1, success }))
                    )
                );

                // Find first working provider
                const workingProvider = results.find(result => result.success);
                if (workingProvider) {
                    setCurrentProvider(workingProvider.index);
                    connected = true;
                }
            }

            if (connected) {
                try {
                    await provider.getBlockNumber();
                    setRpcStatus('connected');
                    setNetworkError('');
                    setValidationAttempts(0);
                } catch (err) {
                    throw new Error('Failed to fetch block number');
                }
            } else {
                throw new Error('All RPC endpoints failed');
            }

        } catch (err) {
            console.error('Network validation failed:', err);
            setNetworkError('Network connection unstable. Retrying...');
            setRpcStatus('error');
            setValidationAttempts(prev => prev + 1);

            if (validationAttempts < MAX_VALIDATION_ATTEMPTS - 1) {
                setTimeout(() => {
                    setIsValidating(false);
                }, AUTO_RETRY_INTERVAL);
            } else {
                setNetworkError('Network connection failed. Please check your connection and try again.');
            }
        } finally {
            setIsValidating(false);
        }
    }, [provider, chainId, switchToFujiTestnet, isValidating, validationAttempts, testConnection]);

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
            <div className="network-error">
                <p>{networkError}</p>
                {validationAttempts >= MAX_VALIDATION_ATTEMPTS && (
                    <button 
                        onClick={() => {
                            setValidationAttempts(0);
                            setIsValidating(false);
                        }}
                        className="retry-button"
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