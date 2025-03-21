import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ContractInterface } from '../utils/contracts';
import { WEB3_CONFIG } from '../config';
import { EthereumProvider } from '../../types/ethereum';

// Global connection lock
let isConnectionInProgress = false;
let connectionLockTimeout: NodeJS.Timeout | null = null;

const WALLET_CONNECTED_KEY = 'nebula_wallet_connected';
const RPC_CONFIG = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig;

// Helper function for RPC retries
async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = RPC_CONFIG.maxRetries,
    getDelay = RPC_CONFIG.customBackoff
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;
            if (attempt === maxRetries) break;
            
            // Only retry on RPC errors or network issues
            if (err.code !== -32603 && !err.message?.includes('network')) {
                throw err;
            }
            
            await new Promise(resolve => setTimeout(resolve, getDelay(attempt)));
        }
    }
    
    throw lastError;
}

// Add type guard for window.ethereum
function hasEthereum(): boolean {
    return typeof window !== 'undefined' && window.ethereum !== undefined;
}

function getEthereum(): EthereumProvider {
    if (!hasEthereum()) {
        throw new Error('Ethereum provider not found');
    }
    return window.ethereum as EthereumProvider;
}

const initializeProvider = (ethereum: EthereumProvider) => {
    return new ethers.providers.Web3Provider(ethereum as ethers.providers.ExternalProvider, {
        name: WEB3_CONFIG.NETWORKS.TESTNET.name,
        chainId: WEB3_CONFIG.NETWORKS.TESTNET.chainId,
        ensAddress: undefined
    });
};

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

    const clearConnectionTimeout = useCallback(() => {
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            setConnectionTimeout(null);
        }
    }, [connectionTimeout]);

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
        if (!hasEthereum()) {
            throw new Error('MetaMask is not installed');
        }
        
        const ethereum = getEthereum();
        setIsNetworkSwitching(true);
        
        try {
            setError('');
            const currentChainId = await ethereum.request({ method: 'eth_chainId' });

            if (currentChainId === `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`) {
                setIsNetworkSwitching(false);
                return;
            }

            try {
                await ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}` }],
                });
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    await ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`,
                            chainName: WEB3_CONFIG.NETWORKS.TESTNET.chainName,
                            nativeCurrency: WEB3_CONFIG.NETWORKS.TESTNET.nativeCurrency,
                            rpcUrls: [WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl],
                            blockExplorerUrls: [WEB3_CONFIG.NETWORKS.TESTNET.blockExplorerUrl]
                        }]
                    });
                } else {
                    throw switchError;
                }
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
        if (!hasEthereum()) {
            setNeedsWallet(true);
            return;
        }

        const ethereum = getEthereum();
        try {
            const accounts = await retryOperation(() =>
                ethereum.request({
                    method: 'eth_accounts'
                })
            );
            
            if (accounts.length > 0) {
                const web3Provider = initializeProvider(ethereum);

                const network = await retryOperation(async () => {
                    const result = await Promise.race([
                        web3Provider.getNetwork(),
                        new Promise<never>((_, reject) => 
                            setTimeout(() => reject(new Error('Network fetch timeout')), 
                            WEB3_CONFIG.ETHERS_CONFIG.timeout
                        ))
                    ]);
                    return result;
                });

                setProvider(web3Provider);
                setContractInterface(new ContractInterface(web3Provider));
                setAccount(accounts[0]);
                setChainId(network.chainId);
                setIsInitialized(true);
                setNeedsWallet(false);

                if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                    await switchToFujiTestnet();
                }
            } else {
                setNeedsWallet(true);
            }
        } catch (err: any) {
            console.error('Failed to initialize web3:', err);
            resetConnectionState();
            
            const retryInitialization = async (retriesLeft: number): Promise<void> => {
                if (retriesLeft <= 0) throw err;
                
                try {
                    await new Promise(resolve => 
                        setTimeout(resolve, RPC_CONFIG.customBackoff(
                            RPC_CONFIG.maxRetries - retriesLeft
                        ))
                    );
                    await initializeWeb3();
                } catch (retryErr) {
                    await retryInitialization(retriesLeft - 1);
                }
            };

            if (err.code === -32603 || err.message?.includes('network')) {
                await retryInitialization(RPC_CONFIG.maxRetries);
            }
            throw err;
        }
    }, [resetConnectionState, switchToFujiTestnet]);

    const clearConnectionLock = useCallback(() => {
        if (connectionLockTimeout) {
            clearTimeout(connectionLockTimeout);
            connectionLockTimeout = null;
        }
        isConnectionInProgress = false;
    }, []);

    const connectWallet = useCallback(async () => {
        if (!hasEthereum()) {
            throw new Error('MetaMask is not installed');
        }

        if (isConnectionInProgress) {
            throw new Error('Connection already in progress');
        }

        const ethereum = getEthereum();
        try {
            setIsConnecting(true);
            setError('');
            isConnectionInProgress = true;

            connectionLockTimeout = setTimeout(() => {
                clearConnectionLock();
                setIsConnecting(false);
                setError('Connection request timed out');
            }, WEB3_CONFIG.CONNECTION_CONFIG.timeoutMs);

            let retryCount = 0;
            let success = false;

            while (!success && retryCount < WEB3_CONFIG.CONNECTION_CONFIG.retryCount) {
                try {
                    const accounts = await retryOperation(() =>
                        ethereum.request({
                            method: 'eth_requestAccounts'
                        })
                    );

                    if (!accounts || accounts.length === 0) {
                        throw new Error('No accounts found');
                    }

                    const web3Provider = new ethers.providers.Web3Provider(ethereum as ethers.providers.ExternalProvider, 'any');
                    const network = await retryOperation(() => web3Provider.getNetwork());
                    
                    setProvider(web3Provider);
                    setAccount(accounts[0]);
                    setChainId(network.chainId);
                    setContractInterface(new ContractInterface(web3Provider));
                    setIsInitialized(true);
                    setNeedsWallet(false);

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
            localStorage.removeItem(WALLET_CONNECTED_KEY);
            resetConnectionState();
            if (hasEthereum()) {
                try {
                    await getEthereum().request({
                        method: 'wallet_revokePermissions',
                        params: [{ eth_accounts: {} }]
                    });
                } catch (err) {
                    console.log('Error revoking permissions:', err);
                }
            }
        }
    }, [provider, resetConnectionState]);

    useEffect(() => {
        if (!isInitialized && !isConnecting && localStorage.getItem(WALLET_CONNECTED_KEY)) {
            initializeWeb3();
        }
        return () => {
            clearConnectionLock();
        };
    }, [isInitialized, isConnecting, initializeWeb3, clearConnectionLock]);

    useEffect(() => {
        if (hasEthereum()) {
            const ethereum = getEthereum();
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

            const handleDisconnect = () => {
                resetConnectionState();
            };

            ethereum.on('accountsChanged', handleAccountsChanged);
            ethereum.on('chainChanged', handleChainChanged);
            ethereum.on('disconnect', handleDisconnect);

            return () => {
                if (hasEthereum()) {
                    const ethereum = getEthereum();
                    ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    ethereum.removeListener('chainChanged', handleChainChanged);
                    ethereum.removeListener('disconnect', handleDisconnect);
                }
            };
        }
    }, [provider, initializeWeb3, resetConnectionState, clearConnectionTimeout, switchToFujiTestnet]);

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