import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import { IPAsset } from '../types/ipAsset';
import styled from 'styled-components';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

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

const IPAssetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { contractInterface } = useWeb3Context();
  const [asset, setAsset] = useState<IPAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAsset = async () => {
      if (!id || !contractInterface) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch the asset details from the contract
        const result = await contractInterface.getIPAssetMetadata(id);

        if (!result.success) {
          throw new Error('Failed to load IP asset');
        }

        const asset: IPAsset = {
          tokenId: id,
          owner: result.owner,
          metadata: {
            title: result.metadata.name,
            description: result.metadata.description,
            contentURI: result.metadata.contentURI || '',
            tags: result.metadata.tags || [],
            category: result.metadata.category || 'Other',
            createdAt: Date.now() / 1000, // Use current time as fallback
            images: result.metadata.additionalData?.images || []
          }
        };

        setAsset(asset);
      } catch (err) {
        console.error('Failed to load IP asset:', err);
        setError('Failed to load IP asset details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAsset();
  }, [id, contractInterface]);

  if (isLoading) {
    return (
      <Container>
        <LoadingSpinner message="Loading IP asset details..." />
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

  return (
    <Container>
      <Header>
        <Title>{asset.metadata.title}</Title>
        <BackLink to="/ip-management">Back to IP Management</BackLink>
      </Header>

      <div className="card-3d">
        <h2>IP Asset Details</h2>
        <p>This page is a placeholder for the IP asset details view.</p>
        <p>In the full implementation, this page would display:</p>
        <ul>
          <li>Detailed metadata about the IP asset</li>
          <li>License information</li>
          <li>Royalty configuration</li>
          <li>Derivative works</li>
          <li>Transaction history</li>
        </ul>
        <p>Token ID: {asset.tokenId}</p>
        <p>Owner: {asset.owner}</p>
        <p>Category: {asset.metadata.category}</p>
        <p>Tags: {asset.metadata.tags.join(', ')}</p>
      </div>
    </Container>
  );
};

export default IPAssetDetails;
