import React from 'react';
import styled, { css } from 'styled-components';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const InputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input<{
  hasError: boolean;
  hasIcon: boolean;
  iconPosition: string;
}>`
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.hasError 
    ? props.theme.colors.error 
    : props.theme.colors.border};
  background-color: ${props => props.theme.colors.inputBackground};
  color: ${props => props.theme.colors.text};
  transition: border-color 0.2s, box-shadow 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError 
      ? props.theme.colors.error 
      : props.theme.colors.primary};
    box-shadow: 0 0 0 2px ${props => props.hasError 
      ? props.theme.colors.error + '33' 
      : props.theme.colors.primary + '33'};
  }
  
  &::placeholder {
    color: ${props => props.theme.colors.textTertiary};
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.background};
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  ${props => props.hasIcon && props.iconPosition === 'left' && css`
    padding-left: 2.5rem;
  `}
  
  ${props => props.hasIcon && props.iconPosition === 'right' && css`
    padding-right: 2.5rem;
  `}
`;

const IconWrapper = styled.div<{ position: string }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${props => props.position === 'left' ? 'left: 0.75rem;' : 'right: 0.75rem;'}
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.textSecondary};
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.75rem;
  margin-top: 0.25rem;
`;

export const Input: React.FC<InputProps> = ({
  error,
  icon,
  iconPosition = 'left',
  ...props
}) => {
  return (
    <InputContainer>
      <StyledInput
        hasError={!!error}
        hasIcon={!!icon}
        iconPosition={iconPosition}
        {...props}
      />
      {icon && (
        <IconWrapper position={iconPosition}>
          {icon}
        </IconWrapper>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </InputContainer>
  );
};
