import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ContractInterface } from '../utils/contracts';
import { WEB3_CONFIG } from '../config';

// At the top of the file, add global connection lock
let isConnectionInProgress = false;
let connectionLockTimeout: NodeJS.Timeout | null = null;

// Add local storage key for connection state
const WALLET_CONNECTED_KEY = 'nebula_wallet_connected';

export function useWeb3() {
    const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
    const [contractInterface, setContractInterface] = useState<ContractInterface | null>(null);
    const [account, setAccount] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [chainId, setChainId] = useState<number | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [needsWallet, setNeedsWallet] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
    const [connectionTimeout, setConnectionTimeout] = useState<NodeJS.Timeout | null>(null);

    // Clear connection timeout
    const clearConnectionTimeout = useCallback(() => {
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            setConnectionTimeout(null);
        }
    }, [connectionTimeout]);

    // Reset connection state
    const resetConnectionState = useCallback(() => {
        setProvider(null);
        setAccount('');
        setChainId(null);
        setContractInterface(null);
        setIsInitialized(false);
        setNeedsWallet(true);
        setError('');
        setIsConnecting(false);
        setIsNetworkSwitching(false);
        clearConnectionTimeout();
    }, [clearConnectionTimeout]);

    const switchToFujiTestnet = useCallback(async (): Promise<void> => {
        if (!window.ethereum) {
            throw new Error('MetaMask is not installed');
        }
        
        setIsNetworkSwitching(true);
        try {
            // Clear any existing errors
            setError('');
            
            // Get current chain ID first
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (currentChainId === `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`) {
                setIsNetworkSwitching(false);
                return; // Already on correct network
            }

            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}` }],
                });
            } catch (switchError: any) {
                // This error code means the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`,
                            chainName: WEB3_CONFIG.NETWORKS.TESTNET.chainName,
                            nativeCurrency: WEB3_CONFIG.NETWORKS.TESTNET.nativeCurrency,
                            rpcUrls: [WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl],
                            blockExplorerUrls: [WEB3_CONFIG.NETWORKS.TESTNET.blockExplorerUrl]
                        }]
                    });
                } else if (switchError.code === -32002) {
                    throw new Error('Network switch already pending in wallet. Please check MetaMask.');
                } else if (switchError.code === 4001) {
                    throw new Error('User rejected network switch.');
                } else {
                    throw switchError;
                }
            }
            
            // Verify the switch was successful
            const newChainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (newChainId !== `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`) {
                throw new Error('Failed to switch network. Please try manually.');
            }
            
        } catch (error: any) {
            console.error('Network switch failed:', error);
            setError(error.message || 'Failed to switch network');
            throw error;
        } finally {
            setIsNetworkSwitching(false);
        }
    }, [setError]);

    const initializeWeb3 = useCallback(async () => {
        if (!window.ethereum) {
            setNeedsWallet(true);
            return;
        }

        try {
            const accounts = await window.ethereum.request({
                method: 'eth_accounts'
            });
            
            if (accounts.length > 0) {
                const web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
                const network = await web3Provider.getNetwork();
                setProvider(web3Provider);
                setContractInterface(new ContractInterface(web3Provider));
                setAccount(accounts[0]);
                setChainId(network.chainId);
                setIsInitialized(true);
                setNeedsWallet(false);

                if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                    try {
                        await switchToFujiTestnet();
                    } catch (err) {
                        resetConnectionState();
                    }
                }
            } else {
                setNeedsWallet(true);
            }
        } catch (err) {
            console.error('Failed to initialize web3:', err);
            resetConnectionState();
        }
    }, [switchToFujiTestnet, resetConnectionState]);

    const clearConnectionLock = useCallback(() => {
        if (connectionLockTimeout) {
            clearTimeout(connectionLockTimeout);
            connectionLockTimeout = null;
        }
        isConnectionInProgress = false;
    }, []);

    const connectWallet = useCallback(async () => {
        if (!window.ethereum) {
            throw new Error('MetaMask is not installed');
        }

        if (isConnectionInProgress) {
            throw new Error('Connection already in progress');
        }

        try {
            setIsConnecting(true);
            setError('');
            isConnectionInProgress = true;

            // Set a timeout to clear the connection lock
            connectionLockTimeout = setTimeout(() => {
                clearConnectionLock();
                setIsConnecting(false);
                setError('Connection request timed out');
            }, WEB3_CONFIG.CONNECTION_CONFIG.timeoutMs);

            // Try to connect with retries
            let retryCount = 0;
            let success = false;

            while (!success && retryCount < WEB3_CONFIG.CONNECTION_CONFIG.retryCount) {
                try {
                    const accounts = await window.ethereum.request({
                        method: 'eth_requestAccounts'
                    });

                    if (!accounts || accounts.length === 0) {
                        throw new Error('No accounts found');
                    }

                    // Initialize Web3 provider
                    const web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
                    const network = await web3Provider.getNetwork();
                    
                    setProvider(web3Provider);
                    setAccount(accounts[0]);
                    setChainId(network.chainId);
                    setContractInterface(new ContractInterface(web3Provider));
                    setIsInitialized(true);
                    setNeedsWallet(false);

                    // Switch network if needed
                    if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                        await switchToFujiTestnet();
                    }

                    success = true;
                    localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
                } catch (err: any) {
                    retryCount++;
                    if (retryCount >= WEB3_CONFIG.CONNECTION_CONFIG.retryCount) {
                        throw err;
                    }
                    await new Promise(resolve => 
                        setTimeout(resolve, WEB3_CONFIG.CONNECTION_CONFIG.retryDelayMs)
                    );
                }
            }
        } catch (err: any) {
            console.error('Wallet connection error:', err);
            resetConnectionState();
            
            if (err.code === 4001) {
                throw new Error('Please accept the connection request in MetaMask');
            } else if (err.code === -32002) {
                throw new Error('Connection request already pending. Please check MetaMask');
            } else if (err.code === -32603) {
                throw new Error('Network connection error. Please check your wallet and try again');
            } else {
                throw new Error(err.message || 'Failed to connect wallet');
            }
        } finally {
            clearConnectionLock();
            setIsConnecting(false);
        }
    }, [clearConnectionLock, switchToFujiTestnet, resetConnectionState]);

    const disconnectWallet = useCallback(async () => {
        if (provider) {
            // Clear local storage connection state
            localStorage.removeItem(WALLET_CONNECTED_KEY);
            
            // Reset all states
            resetConnectionState();
            
            // Clear any cached provider state
            if (window.ethereum) {
                try {
                    // Remove the site from MetaMask permissions
                    await window.ethereum.request({
                        method: 'wallet_revokePermissions',
                        params: [{ eth_accounts: {} }]
                    });
                } catch (err) {
                    console.log('Error revoking permissions:', err);
                }
            }
        }
    }, [provider, resetConnectionState]);

    // Initialize Web3 on component mount only if previously connected
    useEffect(() => {
        if (!isInitialized && !isConnecting && localStorage.getItem(WALLET_CONNECTED_KEY)) {
            initializeWeb3();
        }
        return () => {
            clearConnectionLock();
        };
    }, [isInitialized, isConnecting, initializeWeb3, clearConnectionLock]);

    // Setup event listeners
    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = async (accounts: string[]) => {
                clearConnectionTimeout();
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                    if (!provider) {
                        await initializeWeb3();
                    }
                } else {
                    resetConnectionState();
                }
            };

            const handleChainChanged = async (newChainId: string) => {
                clearConnectionTimeout();
                const chainIdNum = parseInt(newChainId, 16);
                setChainId(chainIdNum);
                
                if (chainIdNum !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                    setError(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
                    try {
                        await switchToFujiTestnet();
                    } catch (err) {
                        console.error('Auto network switch failed:', err);
                    }
                } else {
                    setError('');
                    await initializeWeb3();
                }
            };

            const handleDisconnect = (error: { code: number; message: string }) => {
                console.log('Wallet disconnect event:', error);
                resetConnectionState();
            };

            // Set up listeners
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            window.ethereum.on('disconnect', handleDisconnect);

            // Cleanup
            return () => {
                if (window.ethereum?.removeListener) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener('chainChanged', handleChainChanged);
                    window.ethereum.removeListener('disconnect', handleDisconnect);
                }
            };
        }
    }, [provider, initializeWeb3, resetConnectionState, clearConnectionTimeout, switchToFujiTestnet]);

    // Added missing dependency
    useEffect(() => {
        clearConnectionLock();
    }, [clearConnectionLock]);

    return {
        provider,
        contractInterface,
        account,
        error,
        chainId,
        needsWallet,
        isConnecting,
        isNetworkSwitching,
        connectWallet,
        disconnectWallet,
        switchToFujiTestnet
    } as const;
}