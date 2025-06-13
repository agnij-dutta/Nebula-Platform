import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ContractInterface } from '../utils/contracts';
import { WEB3_CONFIG } from '../config';
import { EthereumProvider } from '../../types/ethereum';

// Global connection lock
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

            // Retry on RPC errors, network issues, or gas estimation failures
            if (err.code === -32603 ||
                err.message?.includes('network') ||
                err.message?.includes('gas') ||
                err.message?.includes('timeout')) {
                console.warn(`RPC attempt ${attempt + 1} failed, retrying...`, err);
            await new Promise(resolve => setTimeout(resolve, getDelay(attempt)));
                continue;
            }

            throw err;
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
    }, []);

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

                // Check if we're on the correct network
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
    }, []);

    const connectWallet = useCallback(async () => {
        if (!window.ethereum) {
            alert('MetaMask is not installed!');
            return;
        }

        try {
            setIsConnecting(true);
            setIsInitialized(false);  // Reset initialization state

            // Direct call to MetaMask - this should trigger the popup
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const address = await signer.getAddress();
                const network = await provider.getNetwork();

                setAccount(address);
                setProvider(provider);
                setChainId(network.chainId);
                setContractInterface(new ContractInterface(provider));
                setIsInitialized(true);  // Set initialization to true after successful connection
                setNeedsWallet(false);
            }
        } catch (error) {
            console.error('Error connecting to MetaMask', error);
            resetConnectionState();
        } finally {
            setIsConnecting(false);
        }
    }, [resetConnectionState]);

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

    // No auto-reconnect - user must explicitly connect

    useEffect(() => {
        if (hasEthereum()) {
            const ethereum = getEthereum();
            const handleAccountsChanged = async (accounts: string[]) => {
                // Only update if we already have a provider (user has explicitly connected)
                if (provider && accounts.length > 0) {
                    setAccount(accounts[0]);
                } else if (provider && accounts.length === 0) {
                    // User disconnected their wallet
                    resetConnectionState();
                }
            };

            const handleChainChanged = async (newChainId: string) => {
                // Only handle chain changes if we're already connected
                if (provider) {
                    const chainIdNum = parseInt(newChainId, 16);
                    setChainId(chainIdNum);

                    if (chainIdNum !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                        setError(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
                    } else {
                        setError('');
                    }
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
    }, [provider, resetConnectionState]);

    useEffect(() => {
        clearConnectionLock();
    }, [clearConnectionLock]);

    // Return the web3 context
    return {
        account,
        provider,
        contractInterface,
        error,
        chainId,
        isInitialized,
        needsWallet,
        isConnecting,
        isNetworkSwitching,
        connectWallet,
        disconnectWallet,
        switchToFujiTestnet
    };
}