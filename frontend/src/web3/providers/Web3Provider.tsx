import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchNetwork, useNetwork } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WEB3_CONFIG } from '../config';
import { ContractInterface } from '../utils/contracts';
import { toast } from 'react-hot-toast';

// Constants
const MAX_CONNECTION_ATTEMPTS = 3;
const WALLET_CONNECTED_KEY = 'wallet_connected';

// Types
interface Web3ContextType {
  account: `0x${string}` | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isNetworkSwitching: boolean;
  needsWallet: boolean;
  chainId: number | undefined;
  isWrongNetwork: boolean;
  error: string | null;
  contractInterface: ContractInterface | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToFujiTestnet: () => Promise<void>;
}

// Context
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

// Provider Props
interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, isLoading: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchNetwork } = useSwitchNetwork();
  const { chain } = useNetwork();

  // Local state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [needsWallet, setNeedsWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractInterface, setContractInterface] = useState<ContractInterface | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Use wagmi's chain detection and allow both Fuji testnet (43113) and mainnet for testing
  const chainId = chain?.id;
  const isWrongNetwork = chainId !== undefined && 
    chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId && 
    chainId !== WEB3_CONFIG.NETWORKS.MAINNET.chainId;

  // Initialize contract interface when connected
  useEffect(() => {
    if (isConnected && address && window.ethereum) {
      try {
        // Use ethers directly instead of window.ethers
        const { ethers } = require('ethers');
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractInterface = new ContractInterface(provider);
        setContractInterface(contractInterface);
      } catch (error) {
        console.error("Failed to initialize contract interface:", error);
        setContractInterface(null);
      }
    } else {
      setContractInterface(null);
    }
  }, [isConnected, address]);

  // Check if wallet is available
  useEffect(() => {
    setNeedsWallet(!window.ethereum);
  }, []);

  // Reset connection attempt counter when connection is successful
  useEffect(() => {
    if (isConnected && address) {
      setConnectionAttempts(0);
      setError(null);
      toast.success('Wallet connected successfully!');
    }
  }, [isConnected, address]);

  const connectWallet = useCallback(async () => {
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      const errorMsg = 'Maximum connection attempts reached. Please refresh the page and try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      setConnectionAttempts(prev => prev + 1);

      // Check if MetaMask is installed
      if (!window.ethereum) {
        const errorMsg = 'MetaMask is not installed. Please install MetaMask and try again.';
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      
      // Try to connect with MetaMask
      const connector = new InjectedConnector();
      await connect({ connector });

      // Store wallet connection preference
      localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
      
    } catch (error: any) {
      console.error("Connection error:", error);
      
      let errorMessage = 'Failed to connect wallet';
      
      if (error?.code === 4001 || error?.message?.includes('rejected')) {
        errorMessage = 'Connection rejected by user';
      } else if (error?.message?.includes('already pending')) {
        errorMessage = 'Connection request already pending';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Only show error toast for unexpected errors (not user rejections)
      if (error?.code !== 4001 && 
          !error?.message?.includes('rejected') && 
          !error?.message?.includes('denied') && 
          error?.code !== 4001) {
        toast.error('Failed to connect wallet. ' + error?.message || '');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [connectionAttempts, connect]);

  const disconnectWallet = () => {
    // Disconnect from wagmi/MetaMask
    disconnect();
    setContractInterface(null);
    setError(null);
    localStorage.removeItem(WALLET_CONNECTED_KEY);
    setConnectionAttempts(0);
    toast.success('Wallet disconnected');
  };

  const switchToFujiTestnet = async () => {
    try {
      setIsNetworkSwitching(true);

      // First try switchNetwork if available
      if (switchNetwork) {
        try {
          await switchNetwork(WEB3_CONFIG.NETWORKS.TESTNET.chainId);
          toast.success('Network switched to Avalanche Fuji');
          return;
        } catch (error) {
        }
      }

      // Fallback to direct ethereum request
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}` }],
        });
        toast.success('Network switched to Avalanche Fuji');
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}`,
                  chainName: WEB3_CONFIG.NETWORKS.TESTNET.name,
                  nativeCurrency: WEB3_CONFIG.NETWORKS.TESTNET.nativeCurrency,
                  rpcUrls: WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl,
                  blockExplorerUrls: [WEB3_CONFIG.NETWORKS.TESTNET.blockExplorerUrl],
                },
              ],
            });
            toast.success('Network added and switched to Avalanche Fuji');
          } catch (addError) {
            throw addError;
          }
        } else {
          throw switchError;
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to switch network';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsNetworkSwitching(false);
    }
  };

  const value: Web3ContextType = {
    account: address,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    isNetworkSwitching,
    needsWallet,
    chainId,
    isWrongNetwork,
    error,
    contractInterface,
    connectWallet,
    disconnectWallet,
    switchToFujiTestnet,
  };

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem(WALLET_CONNECTED_KEY);
    if (wasConnected && !isConnected && window.ethereum && connectionAttempts === 0) {
      connectWallet();
    }
  }, [connectWallet, connectionAttempts, isConnected]);

  // Handle ethereum errors
  useEffect(() => {
    if (window.ethereum) {
      const handleError = (error: any) => {
        
        if (error.error && error.error.message) {
          const errorMessage = error.error.message.toLowerCase();
          if (!errorMessage.includes('user denied') && 
              !errorMessage.includes('user rejected') && 
              !errorMessage.includes('user denied')
            ) {
            toast.error('Connection issue: Please check your wallet connection');
          }
        }
      };

      window.ethereum.on('error', handleError);
      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('error', handleError);
        }
      };
    }
  }, []);

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3Context = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3Context must be used within a Web3Provider');
  }
  return context;
};
