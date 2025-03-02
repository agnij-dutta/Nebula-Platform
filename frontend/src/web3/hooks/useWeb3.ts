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
        if (!window.ethereum) return;
        
        setIsNetworkSwitching(true);
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}` }],
            });
        } catch (switchError: any) {
            // This error code means the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`,
                            chainName: WEB3_CONFIG.NETWORKS.TESTNET.name,
                            nativeCurrency: WEB3_CONFIG.NETWORKS.TESTNET.nativeCurrency,
                            rpcUrls: [WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl],
                            blockExplorerUrls: [WEB3_CONFIG.NETWORKS.TESTNET.blockExplorerUrl]
                        }]
                    });
                    // Try switching again after adding the network
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}` }],
                    });
                } catch (addError: any) {
                    console.error('Failed to add network:', addError);
                    setError(`Failed to add ${WEB3_CONFIG.NETWORKS.TESTNET.name}: ${addError.message}`);
                    throw addError;
                }
            } else {
                console.error('Failed to switch network:', switchError);
                setError(`Failed to switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}: ${switchError.message}`);
                throw switchError;
            }
        } finally {
            setIsNetworkSwitching(false);
        }
    }, []);

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

        // Check global lock first
        if (isConnectionInProgress) {
            throw new Error('Please check MetaMask. A connection request is already pending.');
        }

        try {
            setIsConnecting(true);
            setError('');
            isConnectionInProgress = true;

            // Set a timeout to clear the lock after 30 seconds
            connectionLockTimeout = setTimeout(() => {
                clearConnectionLock();
                setIsConnecting(false);
                setError('Connection request timed out. Please try again.');
            }, 30000);

            // Quick check for existing accounts
            const existingAccounts = await window.ethereum.request({ 
                method: 'eth_accounts' 
            });

            // Only proceed with connection if no accounts or not connected
            if (!existingAccounts || existingAccounts.length === 0) {
                const accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts'
                });
                
                if (!accounts || accounts.length === 0) {
                    throw new Error('Please unlock your MetaMask wallet');
                }
            }

            // Initialize provider
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
            const network = await web3Provider.getNetwork();
            
            // Set initial state
            setProvider(web3Provider);
            setAccount(existingAccounts?.[0] || (await web3Provider.listAccounts())[0]);
            setChainId(network.chainId);
            setContractInterface(new ContractInterface(web3Provider));
            setIsInitialized(true);
            setNeedsWallet(false);

            // Switch network if needed
            if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                await switchToFujiTestnet();
            }

            // If connection is successful, store the state
            localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
        } catch (err: any) {
            console.error('Wallet connection error:', err);
            resetConnectionState();
            
            if (err.code === 4001) {
                throw new Error('Please accept the connection request in your wallet');
            } else if (err.code === -32002 || err.message?.includes('already pending')) {
                throw new Error('Please check MetaMask. A connection request is already pending.');
            } else if (err.code === -32603) {
                throw new Error('MetaMask is locked. Please unlock your wallet.');
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
    }, [isInitialized, isConnecting, initializeWeb3]);

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
                const chainIdNum = parseInt(newChainId);
                setChainId(chainIdNum);
                
                if (chainIdNum !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                    setError(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
                } else {
                    setError('');
                    await initializeWeb3();
                }
            };

            const handleDisconnect = () => {
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
    }, [provider, initializeWeb3, resetConnectionState, clearConnectionTimeout]);

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