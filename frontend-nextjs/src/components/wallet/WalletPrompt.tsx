'use client';

import React from 'react';
import styled from 'styled-components';

interface WalletPromptProps {
  message: string;
  onConnect: () => void;
  isLoading: boolean;
  isWrongNetwork: boolean;
  chainId: string;
  onSwitchNetwork: () => void;
  isNetworkSwitching: boolean;
}

const WalletPrompt: React.FC<WalletPromptProps> = ({
  message,
  onConnect,
  isLoading,
  isWrongNetwork,
  chainId,
  onSwitchNetwork,
  isNetworkSwitching
}) => {
  return (
    <PromptContainer>
      <Title>Welcome to Nebula Platform</Title>
      <Description>{message}</Description>
      
      <ConnectButton 
        onClick={onConnect}
        disabled={isLoading}
        className={isLoading ? 'loading' : ''}
      >
        {isLoading ? (
          <>
            Connecting<LoadingDots />
          </>
        ) : (
          'Connect Wallet'
        )}
      </ConnectButton>
      
      {isWrongNetwork && (
        <>
          <NetworkError>
            You're connected to network with chain ID: 0x{chainId}
          </NetworkError>
          <SwitchNetworkButton 
            onClick={onSwitchNetwork}
            disabled={isNetworkSwitching}
            className={isNetworkSwitching ? 'loading' : ''}
          >
            {isNetworkSwitching ? (
              <>
                Switching Network<LoadingDots />
              </>
            ) : (
              'Switch to Avalanche Fuji Testnet'
            )}
          </SwitchNetworkButton>
        </>
      )}
      
      <InfoText>
        Nebula Platform requires MetaMask or a Web3 compatible browser extension.
      </InfoText>
    </PromptContainer>
  );
};

// Styled Components
const PromptContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
  padding: 1rem;
`;

const Title = styled.h2`
  font-size: 1.75rem;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Description = styled.p`
  margin-bottom: 2rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.125rem;
  line-height: 1.5;
`;

const ConnectButton = styled.button`
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: var(--border-radius-sm);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.1), 
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 0 0 transparent;
  width: 100%;
  max-width: 300px;
  margin-bottom: 1rem;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg, 
      transparent, 
      rgba(255, 255, 255, 0.2), 
      transparent
    );
    transition: 0.5s;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 7px 14px rgba(0, 0, 0, 0.1), 
      0 3px 6px rgba(0, 0, 0, 0.08), 
      0 0 20px rgba(139, 92, 246, 0.4);
      
    &::before {
      left: 100%;
    }
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  &.loading {
    background: linear-gradient(45deg, var(--primary-dark), var(--primary));
  }
`;

const LoadingDots = styled.span`
  &::after {
    content: '';
    animation: loadingDots 1.5s infinite;
  }
  
  @keyframes loadingDots {
    0% { content: '.'; }
    33% { content: '..'; }
    66% { content: '...'; }
  }
`;

const NetworkError = styled.p`
  color: #ef4444;
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--border-radius-sm);
  font-size: 0.875rem;
`;

const SwitchNetworkButton = styled(ConnectButton)`
  background: linear-gradient(45deg, #ef4444, #f97316);
  
  &:hover {
    background: linear-gradient(45deg, #dc2626, #ea580c);
    box-shadow: 
      0 7px 14px rgba(0, 0, 0, 0.1), 
      0 3px 6px rgba(0, 0, 0, 0.08), 
      0 0 20px rgba(239, 68, 68, 0.4);
  }
  
  &.loading {
    background: linear-gradient(45deg, #b91c1c, #c2410c);
  }
`;

const InfoText = styled.p`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2rem;
`;

export default WalletPrompt; 