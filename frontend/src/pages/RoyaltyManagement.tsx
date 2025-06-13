import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import { IPAsset, RoyaltyInfo } from '../types/ipAsset';
import styled from 'styled-components';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { formatPercentage } from '../utils/formatters';
import { ethers } from 'ethers';
import SetRoyaltyModal from '../components/IPManagement/SetRoyaltyModal';

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

const RoyaltyCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const RoyaltyDetail = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const DetailLabel = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
`;

const DetailValue = styled.div`
  color: ${props => props.theme.colors.textSecondary};
`;

const RoyaltyManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { contractInterface, account } = useWeb3Context();
  const [asset, setAsset] = useState<IPAsset | null>(null);
  const [royaltyInfo, setRoyaltyInfo] = useState<RoyaltyInfo | null>(null);
  const [pendingRoyalties, setPendingRoyalties] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRoyaltyModal, setShowRoyaltyModal] = useState(false);

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

        // Fetch royalty info for this IP asset
        const salePrice = ethers.utils.parseEther('1'); // 1 ETH as base for calculation
        const royaltyResult = await contractInterface.getRoyaltyInfo(id, salePrice.toString());

        if (royaltyResult.success) {
          // Calculate percentage based on the royalty amount for 1 ETH
          const percentage = ethers.BigNumber.from(royaltyResult.royaltyAmount)
            .mul(10000)
            .div(salePrice);

          const royaltyInfo: RoyaltyInfo = {
            recipient: royaltyResult.receiver,
            percentage: percentage,
            maxAmount: ethers.BigNumber.from(0), // Not supported in ERC2981
            paidAmount: ethers.BigNumber.from(0) // Not tracked in the current implementation
          };

          setRoyaltyInfo(royaltyInfo);
          setPendingRoyalties('0'); // Pending royalties not implemented yet
        } else {
          setRoyaltyInfo(null);
        }
      } catch (err) {
        console.error('Failed to load royalty data:', err);
        setError('Failed to load royalty data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id, contractInterface, account]);

  if (isLoading) {
    return (
      <Container>
        <LoadingSpinner message="Loading royalty information..." />
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
          <Title>Royalty Management</Title>
          <Subtitle>{asset.metadata.title}</Subtitle>
        </div>
        <BackLink to="/ip-management">Back to IP Management</BackLink>
      </Header>

      {isOwner && (
        <ActionBar>
          <Button
            variant="primary"
            onClick={() => setShowRoyaltyModal(true)}
          >
            Configure Royalties
          </Button>
        </ActionBar>
      )}

      <div className="card-3d">
        <h2>Royalty Management</h2>
        <p>This page is a placeholder for the royalty management view.</p>
        <p>In the full implementation, this page would display:</p>
        <ul>
          <li>Current royalty configuration</li>
          <li>Royalty payment history</li>
          <li>Pending royalties</li>
          <li>Withdrawal interface</li>
        </ul>

        {royaltyInfo ? (
          <RoyaltyCard>
            <h3>Current Royalty Configuration</h3>
            <RoyaltyDetail>
              <DetailLabel>Recipient</DetailLabel>
              <DetailValue>{royaltyInfo.recipient}</DetailValue>
            </RoyaltyDetail>
            <RoyaltyDetail>
              <DetailLabel>Percentage</DetailLabel>
              <DetailValue>{formatPercentage(royaltyInfo.percentage.toNumber() / 10000)}</DetailValue>
            </RoyaltyDetail>
            <RoyaltyDetail>
              <DetailLabel>Maximum Amount</DetailLabel>
              <DetailValue>{ethers.utils.formatEther(royaltyInfo.maxAmount)} ETH</DetailValue>
            </RoyaltyDetail>
            <RoyaltyDetail>
              <DetailLabel>Paid Amount</DetailLabel>
              <DetailValue>{ethers.utils.formatEther(royaltyInfo.paidAmount)} ETH</DetailValue>
            </RoyaltyDetail>
            <RoyaltyDetail>
              <DetailLabel>Pending Royalties</DetailLabel>
              <DetailValue>{ethers.utils.formatEther(pendingRoyalties)} ETH</DetailValue>
            </RoyaltyDetail>

            {isOwner && parseFloat(ethers.utils.formatEther(pendingRoyalties)) > 0 && (
              <Button
                variant="success"
                onClick={() => {}}
                fullWidth
                style={{ marginTop: '1rem' }}
              >
                Withdraw Pending Royalties
              </Button>
            )}
          </RoyaltyCard>
        ) : (
          <EmptyState
            message="No royalty configuration"
            description="This IP asset doesn't have royalty configuration yet."
            actionText={isOwner ? "Configure Royalties" : undefined}
            onAction={isOwner ? () => setShowRoyaltyModal(true) : undefined}
          />
        )}
      </div>

      {showRoyaltyModal && id && (
        <SetRoyaltyModal
          tokenId={id}
          currentReceiver={royaltyInfo?.recipient}
          currentPercentage={royaltyInfo ? royaltyInfo.percentage.toNumber() / 100 : undefined}
          onClose={() => setShowRoyaltyModal(false)}
          onSuccess={() => {
            setShowRoyaltyModal(false);
            // Reload data
            const loadData = async () => {
              setIsLoading(true);
              try {
                if (!contractInterface) {
                  throw new Error('Contract interface not initialized');
                }

                // Fetch royalty info for this IP asset
                const salePrice = ethers.utils.parseEther('1'); // 1 ETH as base for calculation
                const royaltyResult = await contractInterface.getRoyaltyInfo(id, salePrice.toString());

                if (royaltyResult.success) {
                  // Calculate percentage based on the royalty amount for 1 ETH
                  const percentage = ethers.BigNumber.from(royaltyResult.royaltyAmount)
                    .mul(10000)
                    .div(salePrice);

                  const royaltyInfo: RoyaltyInfo = {
                    recipient: royaltyResult.receiver,
                    percentage: percentage,
                    maxAmount: ethers.BigNumber.from(0), // Not supported in ERC2981
                    paidAmount: ethers.BigNumber.from(0) // Not tracked in the current implementation
                  };

                  setRoyaltyInfo(royaltyInfo);
                }
              } catch (err) {
                console.error('Failed to reload royalty data:', err);
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

export default RoyaltyManagement;
