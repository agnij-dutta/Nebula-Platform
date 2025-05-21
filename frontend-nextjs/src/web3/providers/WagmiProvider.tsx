'use client';
import React, { useEffect } from 'react';
import { WagmiConfig } from 'wagmi';
import { config } from '../wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

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
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
} 