'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import Header from '@/components/layout/Header';
import WalletPrompt from '@/components/wallet/WalletPrompt';
import NetworkSwitchOverlay from '@/components/wallet/NetworkSwitchOverlay';
import IPListings from '@/components/marketplace/IPListings';

export default function HomePage() {
  const router = useRouter();
  const {
    account,
    isConnected,
    isConnecting,
    isNetworkSwitching,
    needsWallet,
    chainId,
    isWrongNetwork,
    error,
    connectWallet,
    disconnectWallet,
    switchToFujiTestnet
  } = useWalletConnection();
  
  // Use state to track rendering mode to prevent hydration mismatches
  const [mounted, setMounted] = useState(false);
  
  // Only show wallet-dependent UI after component has mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Render minimal version for SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <AppContainer>
        <Header minimal />
        <MainContent>
          <LoadingContainer>
            <LoadingSpinner />
            <p>Loading Nebula Platform...</p>
          </LoadingContainer>
        </MainContent>
      </AppContainer>
    );
  }

  // Now we're on the client, we can safely check wallet state
  if (needsWallet || !isConnected) {
    return (
      <AppContainer className="wallet-not-connected">
        <Header minimal />
        <MainContent>
          <Card3D>
            <WalletPrompt 
              message="Welcome to Nebula Platform! Connect your wallet to get started"
              onConnect={connectWallet}
              isLoading={isConnecting}
              isWrongNetwork={isWrongNetwork}
              chainId={String(chainId)}
              onSwitchNetwork={switchToFujiTestnet}
              isNetworkSwitching={isNetworkSwitching}
            />
          </Card3D>
        </MainContent>
      </AppContainer>
    );
  }

  // Show network switch prompt if wrong network
  if (isWrongNetwork) {
    return (
      <AppContainer className="network-switch-required">
        <Header 
          minimal 
          account={account} 
          isConnected={isConnected} 
        />
        <MainContent>
          <NetworkSwitchOverlay 
            onSwitchNetwork={switchToFujiTestnet} 
            isNetworkSwitching={isNetworkSwitching}
          />
        </MainContent>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Header 
        account={account} 
        isConnected={isConnected} 
        onDisconnect={disconnectWallet}
        isWrongNetwork={isWrongNetwork}
        onSwitchNetwork={switchToFujiTestnet}
        isNetworkSwitching={isNetworkSwitching}
      />
      <MainContent>
        <IPListings />
      </MainContent>
    </AppContainer>
  );
}

// Styled Components
const AppContainer = styled.div`
  text-align: center;
  min-height: 100vh;
  color: rgb(var(--foreground-rgb));
  font-family: var(--font-inter);
  position: relative;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 7rem 1.5rem 2rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  z-index: 1;
`;

const Card3D = styled.div`
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-xl);
  box-shadow: 
    0 10px 25px rgba(0, 0, 0, 0.3),
    0 0 30px rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.2);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  transform: translateZ(0);
  perspective: 1000px;
  max-width: 600px;
  margin: 4rem auto;
  backdrop-filter: blur(10px);
  
  &:hover {
    transform: translateY(-5px) translateZ(0);
    box-shadow: 
      0 15px 35px rgba(0, 0, 0, 0.4),
      0 0 40px rgba(139, 92, 246, 0.2);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  margin: 4rem auto;
  max-width: 600px;
  
  p {
    margin-top: 1rem;
    color: var(--primary-light);
    font-size: 1.125rem;
  }
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid rgba(139, 92, 246, 0.3);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s ease-in-out infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`; 