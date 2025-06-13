import React, { useState } from 'react';
import styled from 'styled-components';
import { useWeb3Context } from '../../web3/providers/Web3Provider';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface SetRoyaltyModalProps {
  tokenId: string;
  currentReceiver?: string;
  currentPercentage?: number;
  onClose: () => void;
  onSuccess: () => void;
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

const HelpText = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 0.25rem;
`;

const SetRoyaltyModal: React.FC<SetRoyaltyModalProps> = ({
  tokenId,
  currentReceiver,
  currentPercentage,
  onClose,
  onSuccess
}) => {
  const { contractInterface, account } = useWeb3Context();

  const [receiver, setReceiver] = useState(currentReceiver || account || '');
  const [percentage, setPercentage] = useState(currentPercentage?.toString() || '2.5');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiver || !percentage) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate receiver address
    if (!receiver.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    // Validate percentage
    const percentageValue = parseFloat(percentage);
    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      setError('Percentage must be between 0 and 100');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Convert percentage to basis points (e.g., 2.5% = 250 basis points)
      const basisPoints = Math.round(percentageValue * 100);

      if (!contractInterface) {
        throw new Error('Contract interface not initialized');
      }

      // Set royalty info
      const result = await contractInterface.setRoyaltyInfo(
        tokenId,
        receiver,
        basisPoints
      );

      if (!result.success) {
        throw new Error('Failed to set royalty info');
      }

      setSuccess('Royalty configuration updated successfully!');

      // Notify parent component
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to set royalty info:', error);
      setError('Failed to set royalty info. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Configure Royalties"
      onClose={onClose}
      width="500px"
    >
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="receiver">Royalty Receiver Address *</Label>
          <Input
            id="receiver"
            value={receiver}
            onChange={e => setReceiver(e.target.value)}
            placeholder="0x..."
            required
          />
          <HelpText>The address that will receive royalty payments</HelpText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="percentage">Royalty Percentage *</Label>
          <Input
            id="percentage"
            value={percentage}
            onChange={e => setPercentage(e.target.value)}
            placeholder="2.5"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
          />
          <HelpText>Percentage of sales that will be paid as royalties (0-100%)</HelpText>
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
            Save Royalty Configuration
          </Button>
        </ButtonGroup>
      </Form>
    </Modal>
  );
};

export default SetRoyaltyModal;
