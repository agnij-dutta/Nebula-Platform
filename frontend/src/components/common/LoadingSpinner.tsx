import React from 'react';
import styled, { keyframes } from 'styled-components';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  message?: string;
}

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const SpinnerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const Spinner = styled.div<{ size: string; color: string }>`
  width: ${props => 
    props.size === 'small' ? '1.5rem' : 
    props.size === 'large' ? '3rem' : '2rem'
  };
  height: ${props => 
    props.size === 'small' ? '1.5rem' : 
    props.size === 'large' ? '3rem' : '2rem'
  };
  border: ${props => 
    props.size === 'small' ? '2px' : 
    props.size === 'large' ? '4px' : '3px'
  } solid rgba(0, 0, 0, 0.1);
  border-top-color: ${props => props.color};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const Message = styled.div`
  margin-top: 1rem;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 1rem;
  text-align: center;
`;

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color,
  message
}) => {
  const spinnerColor = color || '#3498db'; // Default blue color
  
  return (
    <SpinnerContainer>
      <Spinner size={size} color={spinnerColor} />
      {message && <Message>{message}</Message>}
    </SpinnerContainer>
  );
};
