'use client';

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchNetwork } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WEB3_CONFIG } from '@/web3/config';
import { toast } from 'react-hot-toast';

export function useWalletConnection() {
  const { address, isConnected, status } = useAccount();
  const { connect, connectors, isLoading: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchNetwork, isLoading: isNetworkSwitching } = useSwitchNetwork();
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const isWrongNetwork = useMemo(() => {
    // Only check network if we're actually connected
    if (!isConnected) return false;
    return chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId;
  }, [chainId, isConnected]);

  const needsWallet = useMemo(() => {
    return !isConnected;
  }, [isConnected]);

  // Automatically retry connection if there's an issue
  useEffect(() => {
    // Retry connection if needed (max 3 attempts)
    if (error && connectionAttempt < 3 && !isConnected && !isConnecting) {
      const timer = setTimeout(() => {
        console.log(`Retrying wallet connection (attempt ${connectionAttempt + 1}/3)...`);
        setConnectionAttempt(prev => prev + 1);
        connectWallet();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [error, isConnected, isConnecting, connectionAttempt]);

  // Reset connection attempt counter when successfully connected
  useEffect(() => {
    if (isConnected) {
      setConnectionAttempt(0);
      setError(null);
    }
  }, [isConnected]);

  const connectWallet = useCallback(async () => {
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
  }, [connect, connectors]);

  const disconnectWallet = useCallback(() => {
    try {
      disconnect();
      setError(null);
    } catch (err: any) {
      console.error('Failed to disconnect wallet:', err);
      setError(err.message || 'Failed to disconnect wallet');
      toast.error(err.message || 'Failed to disconnect wallet');
    }
  }, [disconnect]);

  const switchToFujiTestnet = useCallback(async () => {
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
  }, [switchNetwork]);

  return {
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
} 