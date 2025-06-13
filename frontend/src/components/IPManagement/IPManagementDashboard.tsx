import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3Context } from '../../web3/providers/Web3Provider';
import IPAssetCard from './IPAssetCard';
import CreateIPModal from './CreateIPModal';
import { IPAsset } from '../../types/ipAsset';
import styled from 'styled-components';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

const IPManagementContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 2rem;
  color: ${props => props.theme.colors.primary};
  text-align: center;
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
`;

const CreateButton = styled.button`
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

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: ${props => props.theme.colors.text};
`;

const AssetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const IPManagementDashboard: React.FC = () => {
  const { account, contractInterface } = useWeb3Context();
  const [ownedAssets, setOwnedAssets] = useState<IPAsset[]>([]);
  const [licensedAssets, setLicensedAssets] = useState<IPAsset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Define loadAssets function before using it in useEffect
  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!contractInterface || !account) {
        throw new Error('Contract interface or account not available');
      }

      // Load owned assets
      const owned = await contractInterface.getOwnedIPAssets(account);
      setOwnedAssets(owned);

      // Load licensed assets
      const licensed = await contractInterface.getLicensedIPAssets(account);
      setLicensedAssets(licensed);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contractInterface, account]);

  // Use the loadAssets function in useEffect
  useEffect(() => {
    if (contractInterface && account) {
      loadAssets();
    }
  }, [contractInterface, account, loadAssets]);



  return (
    <IPManagementContainer>
      <Header>IP Asset Management</Header>

      <ActionBar>
        <CreateButton onClick={() => setShowCreateModal(true)}>
          Create New IP Asset
        </CreateButton>
      </ActionBar>

      <div>
        <SectionTitle>My IP Assets</SectionTitle>
        {isLoading ? (
          <LoadingSpinner message="Loading your IP assets..." />
        ) : ownedAssets.length > 0 ? (
          <AssetsGrid>
            {ownedAssets.map(asset => (
              <IPAssetCard
                key={asset.tokenId}
                asset={asset}
                isOwner={true}
                onUpdate={loadAssets}
              />
            ))}
          </AssetsGrid>
        ) : (
          <EmptyState
            message="You don't own any IP assets yet."
            actionText="Create your first IP asset"
            onAction={() => setShowCreateModal(true)}
          />
        )}
      </div>

      <div>
        <SectionTitle>Licensed IP Assets</SectionTitle>
        {isLoading ? (
          <LoadingSpinner message="Loading your licensed assets..." />
        ) : licensedAssets.length > 0 ? (
          <AssetsGrid>
            {licensedAssets.map(asset => (
              <IPAssetCard
                key={asset.tokenId}
                asset={asset}
                isOwner={false}
                isLicensed={true}
                onUpdate={loadAssets}
              />
            ))}
          </AssetsGrid>
        ) : (
          <EmptyState
            message="You don't have any licensed IP assets yet."
            actionText="Browse the marketplace"
            onAction={() => window.location.href = '/marketplace'}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateIPModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadAssets}
        />
      )}
    </IPManagementContainer>
  );
};

export default IPManagementDashboard;
