import React, { useState } from 'react';
import styled from 'styled-components';
import { useWeb3Context } from '../../web3/providers/Web3Provider';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { TextArea } from '../common/TextArea';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
import { LicenseType, AttributionRequirement } from '../../types/ipAsset';
import { ethers } from 'ethers';

interface CreateLicenseModalProps {
  tokenId: string;
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

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const licenseTypeOptions = [
  { value: LicenseType.STANDARD.toString(), label: 'Standard' },
  { value: LicenseType.COMMERCIAL.toString(), label: 'Commercial' },
  { value: LicenseType.DERIVATIVE.toString(), label: 'Derivative' },
  { value: LicenseType.EXCLUSIVE.toString(), label: 'Exclusive' }
];

const attributionOptions = [
  { value: AttributionRequirement.NONE.toString(), label: 'None' },
  { value: AttributionRequirement.REQUIRED.toString(), label: 'Required' },
  { value: AttributionRequirement.PROMINENT.toString(), label: 'Prominent' }
];

const CreateLicenseModal: React.FC<CreateLicenseModalProps> = ({
  tokenId,
  onClose,
  onSuccess
}) => {
  const { contractInterface } = useWeb3Context();

  const [licenseType, setLicenseType] = useState(LicenseType.STANDARD.toString());
  const [allowCommercialUse, setAllowCommercialUse] = useState(false);
  const [allowModifications, setAllowModifications] = useState(false);
  const [attribution, setAttribution] = useState(AttributionRequirement.REQUIRED.toString());
  const [royaltyPercentage, setRoyaltyPercentage] = useState('2.5');
  const [duration, setDuration] = useState('365'); // days
  const [maxRevenue, setMaxRevenue] = useState('');
  const [additionalTerms, setAdditionalTerms] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!licenseType || !attribution || !duration) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate percentage
    const percentageValue = parseFloat(royaltyPercentage);
    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      setError('Royalty percentage must be between 0 and 100');
      return;
    }

    // Validate duration
    const durationValue = parseInt(duration);
    if (isNaN(durationValue) || durationValue <= 0) {
      setError('Duration must be a positive number');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Convert percentage to basis points (e.g., 2.5% = 250 basis points)
      const basisPoints = Math.round(percentageValue * 100);

      // Calculate expiration timestamp
      const expirationTimestamp = Math.floor(Date.now() / 1000) + (durationValue * 24 * 60 * 60);

      // Create license data
      const licenseData = {
        licenseType: parseInt(licenseType),
        isCommercial: allowCommercialUse,
        allowModifications,
        requiresAttribution: parseInt(attribution) > 0,
        royaltyPercentage: basisPoints,
        validUntil: expirationTimestamp,
        maxRevenue: maxRevenue ? ethers.utils.parseEther(maxRevenue) : 0,
        additionalTerms
      };

      if (!contractInterface) {
        throw new Error('Contract interface not initialized');
      }

      // Create license
      const result = await contractInterface.createLicense(tokenId, licenseData);

      if (!result.success) {
        throw new Error('Failed to create license');
      }

      setSuccess('License created successfully!');

      // Notify parent component
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to create license:', error);
      setError('Failed to create license. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create License Template"
      onClose={onClose}
      width="600px"
    >
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="licenseType">License Type *</Label>
          <Select
            id="licenseType"
            value={licenseType}
            onChange={e => setLicenseType(e.target.value)}
            options={licenseTypeOptions}
            required
          />
          <HelpText>The type of license to create</HelpText>
        </FormGroup>

        <FormGroup>
          <Label>Permissions</Label>
          <CheckboxGroup>
            <Checkbox
              id="allowCommercialUse"
              checked={allowCommercialUse}
              onChange={e => setAllowCommercialUse(e.target.checked)}
              label="Allow Commercial Use"
            />
            <Checkbox
              id="allowModifications"
              checked={allowModifications}
              onChange={e => setAllowModifications(e.target.checked)}
              label="Allow Modifications"
            />
          </CheckboxGroup>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="attribution">Attribution Requirement *</Label>
          <Select
            id="attribution"
            value={attribution}
            onChange={e => setAttribution(e.target.value)}
            options={attributionOptions}
            required
          />
          <HelpText>How the original creator should be attributed</HelpText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="royaltyPercentage">Royalty Percentage *</Label>
          <Input
            id="royaltyPercentage"
            value={royaltyPercentage}
            onChange={e => setRoyaltyPercentage(e.target.value)}
            placeholder="2.5"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
          />
          <HelpText>Percentage of revenue that must be paid to the IP owner</HelpText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="duration">Duration (days) *</Label>
          <Input
            id="duration"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="365"
            type="number"
            min="1"
            required
          />
          <HelpText>How long the license will be valid for</HelpText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="maxRevenue">Maximum Revenue (ETH)</Label>
          <Input
            id="maxRevenue"
            value={maxRevenue}
            onChange={e => setMaxRevenue(e.target.value)}
            placeholder="Optional"
            type="number"
            step="0.01"
            min="0"
          />
          <HelpText>Maximum revenue allowed under this license (leave empty for unlimited)</HelpText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="additionalTerms">Additional Terms</Label>
          <TextArea
            id="additionalTerms"
            value={additionalTerms}
            onChange={e => setAdditionalTerms(e.target.value)}
            placeholder="Enter any additional license terms..."
            rows={4}
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
            Create License
          </Button>
        </ButtonGroup>
      </Form>
    </Modal>
  );
};

export default CreateLicenseModal;
