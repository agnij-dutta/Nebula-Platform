import React, { useState } from 'react';
import styled from 'styled-components';
import { useWeb3Context } from '../../web3/providers/Web3Provider';
import { ipfsService } from '../../web3/utils/ipfs';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { TextArea } from '../common/TextArea';
import { Select } from '../common/Select';
import { TagInput } from '../common/TagInput';
import { FileUpload } from '../common/FileUpload';

interface CreateIPModalProps {
  onClose: () => void;
  onSuccess: () => void;
  parentTokenId?: string;
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

const SuccessMessage = styled.div`
  color: ${props => props.theme.colors.success};
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

const categories = [
  { value: 'art', label: 'Art' },
  { value: 'music', label: 'Music' },
  { value: 'literature', label: 'Literature' },
  { value: 'film', label: 'Film & Video' },
  { value: 'photography', label: 'Photography' },
  { value: 'software', label: 'Software' },
  { value: 'game', label: 'Game' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' }
];

const CreateIPModal: React.FC<CreateIPModalProps> = ({
  onClose,
  onSuccess,
  parentTokenId
}) => {
  const { contractInterface } = useWeb3Context();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [contentURI, setContentURI] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !category) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Upload files to IPFS if any
      let images: string[] = [];

      if (files.length > 0) {
        const uploadResults = await Promise.all(
          files.map(file => ipfsService.uploadFile(file))
        );

        // The uploadFile function returns a string (CID)
        images = uploadResults.map(cid => `ipfs://${cid}`);
      }

      // Create metadata object
      const metadata = {
        title,
        description,
        contentURI: contentURI || '',
        tags,
        category,
        createdAt: Math.floor(Date.now() / 1000),
        images
      };

      // Create IP asset
      if (!contractInterface) {
        throw new Error('Contract interface not initialized');
      }

      if (parentTokenId) {
        // Create derivative IP
        await contractInterface.createDerivativeIP(
          parentTokenId,
          title,
          description,
          contentURI || ''
        );
      } else {
        // Create new IP
        await contractInterface.createIPAsset(metadata);
      }

      setSuccess('IP asset created successfully!');

      // Notify parent component
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to create IP asset:', error);
      setError('Failed to create IP asset. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={parentTokenId ? 'Create Derivative IP' : 'Create New IP Asset'}
      onClose={onClose}
      width="600px"
    >
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter a title for your IP asset"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="description">Description *</Label>
          <TextArea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your IP asset"
            rows={4}
            required
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="category">Category *</Label>
          <Select
            id="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            options={categories}
            placeholder="Select a category"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="tags">Tags</Label>
          <TagInput
            id="tags"
            tags={tags}
            onTagsChange={setTags}
            placeholder="Add tags (press Enter after each tag)"
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="contentURI">Content URI</Label>
          <Input
            id="contentURI"
            value={contentURI}
            onChange={e => setContentURI(e.target.value)}
            placeholder="Enter a URI for your content (optional)"
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="files">Upload Files</Label>
          <FileUpload
            id="files"
            files={files}
            onFilesChange={setFiles}
            accept="image/*"
            multiple
          />
        </FormGroup>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <ButtonGroup>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            {parentTokenId ? 'Create Derivative IP' : 'Create IP Asset'}
          </Button>
        </ButtonGroup>
      </Form>
    </Modal>
  );
};

export default CreateIPModal;
