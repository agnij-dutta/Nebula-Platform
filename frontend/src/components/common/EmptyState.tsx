import React from 'react';
import styled from 'styled-components';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  background-color: ${props => props.theme.colors.background};
  border-radius: 8px;
`;

const IconContainer = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  color: ${props => props.theme.colors.textTertiary};
`;

const Message = styled.h3`
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  color: ${props => props.theme.colors.text};
`;

const Description = styled.p`
  font-size: 1rem;
  margin: 0 0 1.5rem 0;
  color: ${props => props.theme.colors.textSecondary};
  max-width: 500px;
`;

const ActionButton = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
`;

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  message,
  description,
  actionText,
  onAction
}) => {
  return (
    <EmptyStateContainer>
      {icon ? (
        <IconContainer>{icon}</IconContainer>
      ) : (
        <IconContainer>📭</IconContainer>
      )}
      <Message>{message}</Message>
      {description && <Description>{description}</Description>}
      {actionText && onAction && (
        <ActionButton onClick={onAction}>
          {actionText}
        </ActionButton>
      )}
    </EmptyStateContainer>
  );
};
