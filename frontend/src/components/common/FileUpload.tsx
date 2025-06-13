import React, { useRef, useState } from 'react';
import styled from 'styled-components';

interface FileUploadProps {
  id?: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  error?: string;
}

const FileUploadContainer = styled.div`
  width: 100%;
`;

const DropZone = styled.div<{ isDragActive: boolean; hasError: boolean }>`
  border: 2px dashed ${props => props.hasError 
    ? props.theme.colors.error 
    : props.isDragActive 
      ? props.theme.colors.primary 
      : props.theme.colors.border};
  border-radius: 4px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  background-color: ${props => props.isDragActive 
    ? props.theme.colors.primary + '0A' 
    : props.theme.colors.inputBackground};
  transition: all 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.background};
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const UploadIcon = styled.div`
  margin-bottom: 1rem;
  font-size: 2rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const UploadText = styled.div`
  color: ${props => props.theme.colors.text};
  margin-bottom: 0.5rem;
`;

const UploadHint = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.875rem;
`;

const FileList = styled.div`
  margin-top: 1rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: ${props => props.theme.colors.background};
  margin-bottom: 0.5rem;
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FileIcon = styled.div`
  color: ${props => props.theme.colors.primary};
  font-size: 1.25rem;
`;

const FileName = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text};
`;

const FileSize = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  font-size: 1.25rem;
  
  &:hover {
    color: ${props => props.theme.colors.error};
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.75rem;
  margin-top: 0.5rem;
`;

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const FileUpload: React.FC<FileUploadProps> = ({
  id,
  files,
  onFilesChange,
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  error
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [localError, setLocalError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const validateFiles = (fileList: FileList): File[] => {
    const validFiles: File[] = [];
    setLocalError('');
    
    Array.from(fileList).forEach(file => {
      // Check file size
      if (file.size > maxSize) {
        setLocalError(`File "${file.name}" exceeds the maximum size of ${formatFileSize(maxSize)}`);
        return;
      }
      
      // Check file type if accept is specified
      if (accept) {
        const acceptedTypes = accept.split(',').map(type => type.trim());
        const fileType = file.type;
        const fileExtension = '.' + file.name.split('.').pop();
        
        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            // Check extension
            return fileExtension.toLowerCase() === type.toLowerCase();
          } else if (type.includes('*')) {
            // Check mime type pattern (e.g., image/*)
            const [category, subtype] = type.split('/');
            const [fileCategory, fileSubtype] = fileType.split('/');
            return category === fileCategory && (subtype === '*' || subtype === fileSubtype);
          } else {
            // Check exact mime type
            return type === fileType;
          }
        });
        
        if (!isAccepted) {
          setLocalError(`File "${file.name}" is not an accepted file type`);
          return;
        }
      }
      
      validFiles.push(file);
    });
    
    return validFiles;
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(e.dataTransfer.files);
      
      if (validFiles.length > 0) {
        if (multiple) {
          onFilesChange([...files, ...validFiles]);
        } else {
          onFilesChange(validFiles.slice(0, 1));
        }
      }
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(e.target.files);
      
      if (validFiles.length > 0) {
        if (multiple) {
          onFilesChange([...files, ...validFiles]);
        } else {
          onFilesChange(validFiles.slice(0, 1));
        }
      }
    }
  };
  
  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };
  
  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };
  
  return (
    <FileUploadContainer>
      <DropZone
        isDragActive={isDragActive}
        hasError={!!(error || localError)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <HiddenInput
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
        />
        <UploadIcon>📁</UploadIcon>
        <UploadText>
          {isDragActive ? 'Drop files here' : 'Drag & drop files here or click to browse'}
        </UploadText>
        <UploadHint>
          {multiple ? 'You can upload multiple files' : 'You can upload one file'}
          {maxSize && ` up to ${formatFileSize(maxSize)}`}
          {accept && ` (${accept.replace(/,/g, ', ')})`}
        </UploadHint>
      </DropZone>
      
      {(error || localError) && (
        <ErrorMessage>{error || localError}</ErrorMessage>
      )}
      
      {files.length > 0 && (
        <FileList>
          {files.map((file, index) => (
            <FileItem key={index}>
              <FileInfo>
                <FileIcon>📄</FileIcon>
                <div>
                  <FileName>{file.name}</FileName>
                  <FileSize>{formatFileSize(file.size)}</FileSize>
                </div>
              </FileInfo>
              <RemoveButton
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove file ${file.name}`}
              >
                ×
              </RemoveButton>
            </FileItem>
          ))}
        </FileList>
      )}
    </FileUploadContainer>
  );
};
