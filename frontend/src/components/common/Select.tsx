import React from 'react';
import styled from 'styled-components';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'options'> {
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

const SelectContainer = styled.div`
  position: relative;
  width: 100%;
`;

const StyledSelect = styled.select<{ hasError: boolean }>`
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
  appearance: none;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError 
      ? props.theme.colors.error 
      : props.theme.colors.primary};
    box-shadow: 0 0 0 2px ${props => props.hasError 
      ? props.theme.colors.error + '33' 
      : props.theme.colors.primary + '33'};
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.background};
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  option {
    color: ${props => props.theme.colors.text};
  }
  
  option:first-child {
    color: ${props => props.theme.colors.textTertiary};
  }
`;

const SelectArrow = styled.div`
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  pointer-events: none;
  
  &::before {
    content: '';
    display: block;
    width: 0.5rem;
    height: 0.5rem;
    border-right: 2px solid ${props => props.theme.colors.textSecondary};
    border-bottom: 2px solid ${props => props.theme.colors.textSecondary};
    transform: rotate(45deg);
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.75rem;
  margin-top: 0.25rem;
`;

export const Select: React.FC<SelectProps> = ({
  options,
  error,
  placeholder,
  ...props
}) => {
  return (
    <SelectContainer>
      <StyledSelect
        hasError={!!error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </StyledSelect>
      <SelectArrow />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </SelectContainer>
  );
};
