'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { config } from '../wagmi';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchNetwork } from 'wagmi';
import { WEB3_CONFIG } from '../config';

// Create a client with custom config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Create a context for Web3 state
type Web3ContextType = {
  account: `0x${string}` | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isNetworkSwitching: boolean;
  needsWallet: boolean;
  chainId: number | undefined;
  isWrongNetwork: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToFujiTestnet: () => Promise<void>;
};

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

function Web3StateProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, status } = useAccount();
  
  useEffect(() => {
    if (isConnected && address) {
      console.log('Connected to wallet', { address });
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (!isConnected) {
      console.log('Disconnected from wallet');
    }
  }, [isConnected]);
  
  const { connect, connectors, isLoading: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchNetwork, isLoading: isNetworkSwitching } = useSwitchNetwork();
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const isWrongNetwork = isConnected && chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId;
  const needsWallet = !isConnected;

  // Automatically retry connection if there's an issue
  useEffect(() => {
    if (error && connectionAttempt < 3 && !isConnected && status !== 'connecting') {
      const timer = setTimeout(() => {
        console.log(`Retrying wallet connection (attempt ${connectionAttempt + 1}/3)...`);
        setConnectionAttempt(prev => prev + 1);
        connectWallet();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [error, isConnected, status, connectionAttempt]);

  // Reset connection attempt counter when successfully connected
  useEffect(() => {
    if (isConnected) {
      setConnectionAttempt(0);
      setError(null);
    }
  }, [isConnected]);

  const connectWallet = async () => {
    try {
      setError(null);
      // Try MetaMask first, fall back to any available connector
      const metaMask = connectors.find(c => c.id === 'metaMask');
      const injected = connectors.find(c => c.id === 'injected');
      const walletConnect = connectors.find(c => c.id === 'walletConnect');
      
      const connector = metaMask || injected || walletConnect || connectors[0];
      
      if (connector) {
        await connect({ connector });
      } else {
        throw new Error('No wallet connector available');
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      
      // Don't show toast for user rejection
      if (!errorMessage.includes('rejected') && !errorMessage.includes('denied')) {
        toast.error(errorMessage);
      }
    }
  };

  const disconnectWallet = () => {
    try {
      disconnect();
      setError(null);
      localStorage.removeItem('nebula_wallet_connected');
    } catch (err: any) {
      console.error('Failed to disconnect wallet:', err);
      setError(err.message || 'Failed to disconnect wallet');
      toast.error(err.message || 'Failed to disconnect wallet');
    }
  };

  const switchToFujiTestnet = async () => {
    try {
      setError(null);
      if (switchNetwork) {
        await switchNetwork(WEB3_CONFIG.NETWORKS.TESTNET.chainId);
        toast.success(`Switched to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
      } else {
        throw new Error('Network switching not supported');
      }
    } catch (err: any) {
      console.error('Failed to switch network:', err);
      const errorMessage = err.message || 'Failed to switch network';
      setError(errorMessage);
      
      // Don't show toast for user rejection
      if (!errorMessage.includes('rejected') && !errorMessage.includes('denied')) {
        toast.error(errorMessage);
      }
    }
  };

  // Auto-connect if previously connected
  useEffect(() => {
    if (localStorage.getItem('nebula_wallet_connected')) {
      connectWallet();
    }
  }, []);

  // Save connection state for auto-reconnect
  useEffect(() => {
    if (isConnected) {
      localStorage.setItem('nebula_wallet_connected', 'true');
    }
  }, [isConnected]);

  const value: Web3ContextType = {
    account: address,
    isConnected,
    isConnecting,
    isNetworkSwitching,
    needsWallet,
    chainId,
    isWrongNetwork,
    error,
    connectWallet,
    disconnectWallet,
    switchToFujiTestnet,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  // Listen for global unhandled errors related to web3 connections
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      // Only catch and handle web3/wallet related errors
      const errorMessage = error.message || '';
      if (
        errorMessage.includes('wallet') || 
        errorMessage.includes('MetaMask') || 
        errorMessage.includes('RPC') ||
        errorMessage.includes('chain') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
      ) {
        console.error('Web3 Error:', error);
        
        // Don't show rejection errors to avoid spamming users
        if (
          !errorMessage.includes('rejected') && 
          !errorMessage.includes('denied') &&
          !errorMessage.includes('user denied')
        ) {
          toast.error('Connection issue: Please check your wallet connection');
        }
        
        // Prevent default error handling
        error.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <Web3StateProvider>
          {children}
        </Web3StateProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
} 