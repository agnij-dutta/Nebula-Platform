'use client';

import React from 'react';
import styled from 'styled-components';
import { WEB3_CONFIG } from '@/web3/config';

interface NetworkSwitchOverlayProps {
  onSwitchNetwork: () => void;
  isNetworkSwitching?: boolean;
}

const NetworkSwitchOverlay: React.FC<NetworkSwitchOverlayProps> = ({ 
  onSwitchNetwork,
  isNetworkSwitching = false
}) => {
  return (
    <OverlayContainer>
      <AlertCard>
        <GlowingIcon />
        <Title>Network Switch Required</Title>
        <Description>
          Please switch your wallet to <NetworkName>{WEB3_CONFIG.NETWORKS.TESTNET.name}</NetworkName> to use Nebula Platform.
        </Description>
        <NetworkDetails>
          <DetailItem>
            <DetailLabel>Network Name:</DetailLabel>
            <DetailValue>{WEB3_CONFIG.NETWORKS.TESTNET.chainName}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>Chain ID:</DetailLabel>
            <DetailValue>0x{WEB3_CONFIG.NETWORKS.TESTNET.chainId.toString(16)}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>Currency:</DetailLabel>
            <DetailValue>{WEB3_CONFIG.NETWORKS.TESTNET.nativeCurrency.symbol}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>RPC URL:</DetailLabel>
            <DetailValue>{WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0]}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>Block Explorer:</DetailLabel>
            <DetailValue>{WEB3_CONFIG.NETWORKS.TESTNET.blockExplorerUrl}</DetailValue>
          </DetailItem>
        </NetworkDetails>
        <SwitchButton 
          onClick={onSwitchNetwork}
          disabled={isNetworkSwitching}
          className={isNetworkSwitching ? 'switching' : ''}
        >
          {isNetworkSwitching ? (
            <>Switching Network<LoadingDots /></>
          ) : (
            'Switch Network'
          )}
        </SwitchButton>
        <InfoText>
          If the automatic switch fails, please manually switch to the Avalanche Fuji Testnet in your wallet.
        </InfoText>
      </AlertCard>
    </OverlayContainer>
  );
};

// Styled Components
const OverlayContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
  padding: 2rem;
`;

const AlertCard = styled.div`
  background: rgba(30, 31, 46, 0.8);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius-lg);
  padding: 2.5rem;
  max-width: 600px;
  width: 100%;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 0 50px rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.2);
  position: relative;
  overflow: hidden;
  text-align: center;
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(45deg, #ef4444, #f97316);
  }
`;

const GlowingIcon = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.4);
  position: relative;
  
  &:before, &:after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  &:before {
    width: 30px;
    height: 30px;
    background: #ef4444;
    border-radius: 50%;
    box-shadow: 0 0 20px #ef4444;
    animation: pulse 2s infinite;
  }
  
  &:after {
    width: 20px;
    height: 4px;
    background: white;
    border-radius: 2px;
    transform: translate(-50%, -50%) rotate(45deg);
  }
  
  @keyframes pulse {
    0% { opacity: 0.7; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }
`;

const Title = styled.h2`
  font-size: 1.75rem;
  margin-bottom: 1rem;
  color: #ef4444;
  font-weight: 700;
`;

const Description = styled.p`
  font-size: 1.125rem;
  margin-bottom: 2rem;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
`;

const NetworkName = styled.span`
  color: #f97316;
  font-weight: 600;
`;

const NetworkDetails = styled.div`
  background: rgba(15, 23, 42, 0.5);
  border-radius: var(--border-radius-md);
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const DetailItem = styled.div`
  display: flex;
  margin-bottom: 0.75rem;
  align-items: flex-start;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  min-width: 120px;
  padding-right: 1rem;
  font-size: 0.875rem;
`;

const DetailValue = styled.span`
  font-family: 'Space Grotesk', monospace;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
  font-size: 0.875rem;
  flex: 1;
`;

const SwitchButton = styled.button`
  background: linear-gradient(45deg, #ef4444, #f97316);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: var(--border-radius-sm);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 300px;
  margin: 0 auto 1.5rem;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 7px 14px rgba(0, 0, 0, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
    background: linear-gradient(45deg, #dc2626, #ea580c);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  &.switching {
    background: linear-gradient(45deg, #b91c1c, #c2410c);
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

const InfoText = styled.p`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  max-width: 400px;
  margin: 0 auto;
`;

export default NetworkSwitchOverlay; 