import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

interface TagInputProps {
  id?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  error?: string;
  maxTags?: number;
}

const TagInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const TagInputWrapper = styled.div<{ hasError: boolean; isFocused: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  min-height: 2.5rem;
  border-radius: 4px;
  border: 1px solid ${props => props.hasError 
    ? props.theme.colors.error 
    : props.isFocused 
      ? props.theme.colors.primary 
      : props.theme.colors.border};
  background-color: ${props => props.theme.colors.inputBackground};
  transition: border-color 0.2s, box-shadow 0.2s;
  
  ${props => props.isFocused && `
    box-shadow: 0 0 0 2px ${props.hasError 
      ? props.theme.colors.error + '33' 
      : props.theme.colors.primary + '33'};
  `}
`;

const Tag = styled.div`
  display: flex;
  align-items: center;
  background-color: ${props => props.theme.colors.primary + '33'};
  color: ${props => props.theme.colors.primary};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
`;

const TagText = styled.span`
  margin-right: 0.25rem;
`;

const RemoveTagButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
  
  &:hover {
    color: ${props => props.theme.colors.primaryDark};
  }
`;

const Input = styled.input`
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  padding: 0.25rem;
  font-size: 1rem;
  color: ${props => props.theme.colors.text};
  
  &:focus {
    outline: none;
  }
  
  &::placeholder {
    color: ${props => props.theme.colors.textTertiary};
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.75rem;
  margin-top: 0.25rem;
`;

export const TagInput: React.FC<TagInputProps> = ({
  id,
  tags,
  onTagsChange,
  placeholder = 'Add tags...',
  error,
  maxTags = 10
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };
  
  const addTag = (tag: string) => {
    if (
      tag &&
      !tags.includes(tag) &&
      tags.length < maxTags
    ) {
      const newTags = [...tags, tag];
      onTagsChange(newTags);
      setInputValue('');
    }
  };
  
  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onTagsChange(newTags);
  };
  
  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  return (
    <TagInputContainer ref={containerRef}>
      <TagInputWrapper 
        hasError={!!error} 
        isFocused={isFocused}
        onClick={handleContainerClick}
      >
        {tags.map((tag, index) => (
          <Tag key={index}>
            <TagText>{tag}</TagText>
            <RemoveTagButton 
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </RemoveTagButton>
          </Tag>
        ))}
        <Input
          ref={inputRef}
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          aria-label="Add tags"
        />
      </TagInputWrapper>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </TagInputContainer>
  );
};
