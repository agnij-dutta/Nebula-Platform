'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styled from 'styled-components';
import { WEB3_CONFIG } from '@/web3/config';

interface HeaderProps {
  minimal?: boolean;
  account?: string;
  isConnected?: boolean;
  onDisconnect?: () => void;
  isWrongNetwork?: boolean;
  onSwitchNetwork?: () => void;
  isNetworkSwitching?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  minimal = false,
  account,
  isConnected,
  onDisconnect,
  isWrongNetwork,
  onSwitchNetwork,
  isNetworkSwitching
}) => {
  const pathname = usePathname();
  const [showDisconnect, setShowDisconnect] = useState(false);

  // Determine active page
  const isActive = (path: string) => {
    return pathname === path;
  };

  if (minimal) {
    return (
      <HeaderContainer className="minimal">
        <HeaderContent>
          <LogoContainer>
            <h1>Nebula Platform</h1>
          </LogoContainer>
          {account && isConnected && (
            <WalletSection>
              <AccountInfo>
                <WalletStatus>
                  <WalletIndicator />
                  <span>Connected</span>
                </WalletStatus>
                <Address>
                  {`${account.slice(0, 6)}...${account.slice(-4)}`}
                </Address>
              </AccountInfo>
            </WalletSection>
          )}
        </HeaderContent>
      </HeaderContainer>
    );
  }

  return (
    <HeaderContainer>
      <HeaderContent>
        <LogoContainer>
          <h1>Nebula Platform</h1>
        </LogoContainer>

        <NavLinks>
          <Link href="/" className={isActive('/') ? 'active' : ''}>
            Browse IP
          </Link>
          <Link href="/research" className={isActive('/research') ? 'active' : ''}>
            The Hub
          </Link>
          <Link href="/governance" className={isActive('/governance') ? 'active' : ''}>
            Governance
          </Link>
          <Link href="/staking" className={isActive('/staking') ? 'active' : ''}>
            Stake
          </Link>
          <Link href="/swap" className={isActive('/swap') ? 'active' : ''}>
            Swap
          </Link>
          {account && (
            <>
              <Link href="/create-ip" className={isActive('/create-ip') ? 'active' : ''}>
                Create IP
              </Link>
              <Link href="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                Dashboard
              </Link>
            </>
          )}
        </NavLinks>
        
        <WalletSection>
          {isWrongNetwork ? (
            <NetworkButton 
              onClick={onSwitchNetwork} 
              className={`error ${isNetworkSwitching ? 'switching' : ''}`}
              disabled={isNetworkSwitching}
            >
              {isNetworkSwitching ? (
                <>Switching Network<span className="loading-dots"></span></>
              ) : (
                `Switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`
              )}
            </NetworkButton>
          ) : (
            <AccountInfo
              onMouseEnter={() => setShowDisconnect(true)}
              onMouseLeave={() => setShowDisconnect(false)}
              onClick={showDisconnect ? onDisconnect : undefined}
            >
              <WalletStatus>
                <WalletIndicator />
                <span>{showDisconnect ? 'Disconnect' : 'Connected'}</span>
              </WalletStatus>
              <Address>
                {`${account?.slice(0, 6)}...${account?.slice(-4)}`}
              </Address>
            </AccountInfo>
          )}
        </WalletSection>
      </HeaderContent>
    </HeaderContainer>
  );
};

// Styled Components
const HeaderContainer = styled.header`
  padding: 1rem;
  position: fixed;
  top: 20px;
  left: 20px;
  right: 20px;
  z-index: 100;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  &.minimal {
    padding: 0.5rem;
  }
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius-lg);
  background: rgba(30, 31, 46, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(139, 92, 246, 0.2);
  box-shadow: 
    0 10px 25px rgba(0, 0, 0, 0.3),
    0 0 30px rgba(139, 92, 246, 0.15),
    inset 0 0 10px rgba(139, 92, 246, 0.05);
  transition: all 0.3s ease;
  transform: translateZ(0);
  perspective: 1000px;
  
  &:hover {
    box-shadow: 
      0 15px 35px rgba(0, 0, 0, 0.4),
      0 0 40px rgba(139, 92, 246, 0.2),
      inset 0 0 15px rgba(139, 92, 246, 0.1);
    transform: translateY(-3px) translateZ(0);
  }
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
  
  h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(45deg, var(--primary), var(--secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 2px 10px rgba(139, 92, 246, 0.3);
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(to right, transparent, var(--primary), transparent);
    }
  }
`;

const NavLinks = styled.nav`
  display: flex;
  gap: 1rem;
  perspective: 1000px;
  
  a {
    color: rgb(var(--foreground-rgb));
    text-decoration: none;
    font-family: 'Space Grotesk', sans-serif;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    position: relative;
    transform-style: preserve-3d;
    transform: translateZ(0);
    
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: var(--border-radius-sm);
      background: rgba(139, 92, 246, 0.1);
      transform: translateZ(-10px);
      transition: all 0.3s ease;
      opacity: 0;
    }
    
    &:hover {
      color: var(--primary);
      transform: translateZ(10px);
      
      &::before {
        opacity: 1;
        transform: translateZ(-5px);
      }
    }
    
    &.active {
      color: white;
      font-weight: 600;
      background: linear-gradient(45deg, var(--primary-dark), var(--primary));
      box-shadow: 
        0 5px 15px rgba(0, 0, 0, 0.2),
        0 0 10px rgba(139, 92, 246, 0.3);
      transform: translateZ(10px);
    }
  }
`;

const WalletSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  perspective: 1000px;
`;

const AccountInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: rgba(30, 31, 46, 0.5);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: var(--border-radius-sm);
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(30, 31, 46, 0.8);
    border-color: rgba(139, 92, 246, 0.4);
    transform: translateY(-2px);
  }
`;

const WalletStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
`;

const WalletIndicator = styled.div`
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid #10b981;
    opacity: 0.5;
  }
`;

const Address = styled.span`
  font-family: 'Space Grotesk', monospace;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--primary), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
`;

const NetworkButton = styled.button`
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  font-weight: 600;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 7px 14px rgba(0, 0, 0, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
  }
  
  &.error {
    background: linear-gradient(45deg, #ef4444, #f97316);
    
    &:hover {
      background: linear-gradient(45deg, #dc2626, #ea580c);
    }
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .loading-dots::after {
    content: '...';
    animation: loading 1.5s infinite;
  }
  
  @keyframes loading {
    0% { content: '.'; }
    33% { content: '..'; }
    66% { content: '...'; }
  }
`;

export default Header; 