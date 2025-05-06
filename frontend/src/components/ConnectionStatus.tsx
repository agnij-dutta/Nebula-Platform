import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import styled from 'styled-components';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

const StatusContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: ${({ theme }) => theme?.colors?.background || '#ffffff'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const StatusDot = styled.div<{ status: ConnectionStatus }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${({ status }) => {
    switch (status) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
        return '#FFC107';
      default:
        return '#F44336';
    }
  }};
  transition: background-color 0.3s ease;
`;

const StatusText = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme?.colors?.text || '#000000'};
  font-weight: 500;
`;

const ConnectionStatus: React.FC = () => {
  const { isConnected, error } = useWebSocket();
  
  const getStatus = (): ConnectionStatus => {
    if (isConnected) return 'connected';
    if (error) return 'disconnected';
    return 'connecting';
  };

  const status = getStatus();
  const statusText = {
    connected: 'Connected',
    disconnected: 'Connection Error',
    connecting: 'Connecting...'
  }[status];

  return (
    <StatusContainer>
      <StatusDot status={status} />
      <StatusText>
        {statusText}
      </StatusText>
    </StatusContainer>
  );
};

export default ConnectionStatus;
