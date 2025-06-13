import React from 'react';
import styled, { css, keyframes } from 'styled-components';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const ButtonContainer = styled.button<{
  variant: string;
  size: string;
  $fullWidth: boolean;
  $hasIcon: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-weight: 600;
  transition: all 0.2s;
  cursor: pointer;
  width: ${props => props.$fullWidth ? '100%' : 'auto'};
  
  ${props => props.size === 'small' && css`
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  `}
  
  ${props => props.size === 'medium' && css`
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
  `}
  
  ${props => props.size === 'large' && css`
    padding: 1rem 2rem;
    font-size: 1.125rem;
  `}
  
  ${props => props.variant === 'primary' && css`
    background-color: ${props.theme.colors.primary};
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.primaryDark};
    }
  `}
  
  ${props => props.variant === 'secondary' && css`
    background-color: transparent;
    color: ${props.theme.colors.text};
    border: 1px solid ${props.theme.colors.border};
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.background};
    }
  `}
  
  ${props => props.variant === 'danger' && css`
    background-color: ${props.theme.colors.error};
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.errorDark};
    }
  `}
  
  ${props => props.variant === 'success' && css`
    background-color: ${props.theme.colors.success};
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.successDark};
    }
  `}
  
  ${props => props.variant === 'warning' && css`
    background-color: ${props.theme.colors.warning};
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.warningDark};
    }
  `}
  
  ${props => props.variant === 'info' && css`
    background-color: ${props.theme.colors.info};
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.infoDark};
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  ${props => props.$hasIcon && css`
    .icon {
      margin-right: 0.5rem;
    }
  `}
`;

const LoadingSpinner = styled.div`
  width: 1em;
  height: 1em;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: ${spin} 0.8s linear infinite;
  margin-right: 0.5rem;
`;

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  ...props
}) => {
  return (
    <ButtonContainer
      variant={variant}
      size={size}
      $fullWidth={fullWidth}
      $hasIcon={!!icon}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <LoadingSpinner />
      ) : icon ? (
        <span className="icon">{icon}</span>
      ) : null}
      {children}
    </ButtonContainer>
  );
};
