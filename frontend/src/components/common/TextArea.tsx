import React from 'react';
import styled from 'styled-components';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const TextAreaContainer = styled.div`
  position: relative;
  width: 100%;
`;

const StyledTextArea = styled.textarea<{ hasError: boolean }>`
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
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  
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
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.75rem;
  margin-top: 0.25rem;
`;

export const TextArea: React.FC<TextAreaProps> = ({
  error,
  ...props
}) => {
  return (
    <TextAreaContainer>
      <StyledTextArea
        hasError={!!error}
        {...props}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </TextAreaContainer>
  );
};
