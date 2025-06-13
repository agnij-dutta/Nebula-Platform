import React from 'react';
import styled from 'styled-components';

interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  disabled?: boolean;
}

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  position: absolute;
  opacity: 0;
  height: 0;
  width: 0;
`;

const StyledCheckbox = styled.div<{ checked: boolean; disabled: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: ${props => props.checked 
    ? props.theme.colors.primary 
    : props.theme.colors.background};
  border: 1px solid ${props => props.checked 
    ? props.theme.colors.primary 
    : props.theme.colors.border};
  border-radius: 3px;
  transition: all 0.2s;
  opacity: ${props => props.disabled ? 0.5 : 1};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  
  &:hover {
    border-color: ${props => props.disabled 
      ? props.theme.colors.border 
      : props.theme.colors.primary};
  }
`;

const CheckIcon = styled.svg`
  fill: none;
  stroke: white;
  stroke-width: 2px;
`;

const Label = styled.label<{ disabled: boolean }>`
  margin-left: 8px;
  font-size: 0.875rem;
  color: ${props => props.disabled 
    ? props.theme.colors.textTertiary 
    : props.theme.colors.text};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
`;

export const Checkbox: React.FC<CheckboxProps> = ({ 
  id, 
  checked, 
  onChange, 
  label, 
  disabled = false 
}) => {
  return (
    <CheckboxContainer>
      <HiddenCheckbox 
        id={id}
        checked={checked} 
        onChange={onChange}
        disabled={disabled}
      />
      <StyledCheckbox checked={checked} disabled={disabled}>
        {checked && (
          <CheckIcon viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </CheckIcon>
        )}
      </StyledCheckbox>
      <Label htmlFor={id} disabled={disabled}>
        {label}
      </Label>
    </CheckboxContainer>
  );
};

export default Checkbox;
