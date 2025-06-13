import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import { IPAsset, License } from '../types/ipAsset';
import styled from 'styled-components';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import CreateLicenseModal from '../components/IPManagement/CreateLicenseModal';

const Container = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  color: ${props => props.theme.colors.primary};
`;

const Subtitle = styled.h2`
  font-size: 1.5rem;
  color: ${props => props.theme.colors.text};
  margin-bottom: 1rem;
`;

const BackLink = styled(Link)`
  display: flex;
  align-items: center;
  color: ${props => props.theme.colors.textSecondary};
  text-decoration: none;
  font-size: 1rem;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }

  &::before {
    content: '←';
    margin-right: 0.5rem;
  }
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
`;

const LicenseManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { contractInterface, account } = useWeb3Context();
  const [asset, setAsset] = useState<IPAsset | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id || !contractInterface) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch the asset details from the contract
        const assetResult = await contractInterface.getIPAssetMetadata(id);

        if (!assetResult.success) {
          throw new Error('Failed to load IP asset');
        }

        const asset: IPAsset = {
          tokenId: id,
          owner: assetResult.owner,
          metadata: {
            title: assetResult.metadata.name,
            description: assetResult.metadata.description,
            contentURI: assetResult.metadata.contentURI || '',
            tags: assetResult.metadata.tags || [],
            category: assetResult.metadata.category || 'Other',
            createdAt: Date.now() / 1000, // Use current time as fallback
            images: assetResult.metadata.additionalData?.images || []
          }
        };

        setAsset(asset);

        // Fetch licenses for this IP asset
        const licenseModule = await contractInterface.getLicenseModule();
        const licenseCount = await licenseModule.getLicenseCountForIP(id);

        const licenses: License[] = [];

        for (let i = 0; i < licenseCount; i++) {
          const licenseId = await licenseModule.getLicenseIdForIPByIndex(id, i);
          const licenseData = await licenseModule.getLicense(licenseId);
          const licenseOwner = await licenseModule.ownerOf(licenseId);

          licenses.push({
            licenseId: licenseId.toString(),
            ipTokenId: id,
            owner: licenseOwner,
            terms: {
              licenseType: licenseData.licenseType,
              allowCommercialUse: licenseData.isCommercial,
              allowModifications: licenseData.allowModifications,
              attribution: licenseData.requiresAttribution ? 1 : 0,
              royaltyPercentage: licenseData.royaltyPercentage,
              duration: licenseData.validUntil,
              maxRevenue: licenseData.maxRevenue || 0,
              additionalTerms: licenseData.additionalTerms || ''
            },
            isValid: true,
            expirationDate: licenseData.validUntil ? licenseData.validUntil.toNumber() * 1000 : undefined
          });
        }

        setLicenses(licenses);
      } catch (err) {
        console.error('Failed to load license data:', err);
        setError('Failed to load license data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id, contractInterface, account]);

  if (isLoading) {
    return (
      <Container>
        <LoadingSpinner message="Loading license information..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Header>
          <BackLink to="/ip-management">Back to IP Management</BackLink>
        </Header>
        <div className="error-message">{error}</div>
      </Container>
    );
  }

  if (!asset) {
    return (
      <Container>
        <Header>
          <BackLink to="/ip-management">Back to IP Management</BackLink>
        </Header>
        <div className="error-message">IP asset not found</div>
      </Container>
    );
  }

  const isOwner = asset.owner === account;

  return (
    <Container>
      <Header>
        <div>
          <Title>License Management</Title>
          <Subtitle>{asset.metadata.title}</Subtitle>
        </div>
        <BackLink to="/ip-management">Back to IP Management</BackLink>
      </Header>

      {isOwner && (
        <ActionBar>
          <Button
            variant="primary"
            onClick={() => setShowLicenseModal(true)}
          >
            Create License Template
          </Button>
        </ActionBar>
      )}

      <div className="card-3d">
        <h2>License Management</h2>
        <p>This page is a placeholder for the license management view.</p>
        <p>In the full implementation, this page would display:</p>
        <ul>
          <li>List of active licenses for this IP asset</li>
          <li>License template creation interface</li>
          <li>License issuance workflow</li>
          <li>License revocation controls</li>
        </ul>

        {licenses.length === 0 && (
          <EmptyState
            message="No active licenses"
            description="This IP asset doesn't have any active licenses yet."
            actionText={isOwner ? "Create License Template" : undefined}
            onAction={isOwner ? () => setShowLicenseModal(true) : undefined}
          />
        )}
      </div>

      {showLicenseModal && id && (
        <CreateLicenseModal
          tokenId={id}
          onClose={() => setShowLicenseModal(false)}
          onSuccess={() => {
            setShowLicenseModal(false);
            // Reload data
            const loadData = async () => {
              setIsLoading(true);
              try {
                if (!contractInterface) {
                  throw new Error('Contract interface not initialized');
                }

                // Fetch licenses for this IP asset
                const licenseModule = await contractInterface.getLicenseModule();
                const licenseCount = await licenseModule.getLicenseCountForIP(id);

                const licenses: License[] = [];

                for (let i = 0; i < licenseCount; i++) {
                  const licenseId = await licenseModule.getLicenseIdForIPByIndex(id, i);
                  const licenseData = await licenseModule.getLicense(licenseId);
                  const licenseOwner = await licenseModule.ownerOf(licenseId);

                  licenses.push({
                    licenseId: licenseId.toString(),
                    ipTokenId: id,
                    owner: licenseOwner,
                    terms: {
                      licenseType: licenseData.licenseType,
                      allowCommercialUse: licenseData.isCommercial,
                      allowModifications: licenseData.allowModifications,
                      attribution: licenseData.requiresAttribution ? 1 : 0,
                      royaltyPercentage: licenseData.royaltyPercentage,
                      duration: licenseData.validUntil,
                      maxRevenue: licenseData.maxRevenue || 0,
                      additionalTerms: licenseData.additionalTerms || ''
                    },
                    isValid: true,
                    expirationDate: licenseData.validUntil ? licenseData.validUntil.toNumber() * 1000 : undefined
                  });
                }

                setLicenses(licenses);
              } catch (err) {
                console.error('Failed to reload license data:', err);
              } finally {
                setIsLoading(false);
              }
            };

            loadData();
          }}
        />
      )}
    </Container>
  );
};

export default LicenseManagement;
