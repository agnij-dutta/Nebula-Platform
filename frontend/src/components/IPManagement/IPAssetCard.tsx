import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { IPAsset } from '../../types/ipAsset';
import { formatDate } from '../../utils/formatters';

interface IPAssetCardProps {
  asset: IPAsset;
  isOwner: boolean;
  isLicensed?: boolean;
  onUpdate: () => void;
}

const Card = styled.div<{ isExpanded: boolean }>`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
  height: ${props => props.isExpanded ? 'auto' : '180px'};

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
  }
`;

const CardHeader = styled.div`
  display: flex;
  padding: 1rem;
  cursor: pointer;
`;

const AssetImage = styled.div<{ hasImage?: boolean }>`
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  background-color: ${props => props.hasImage ? 'transparent' : props.theme.colors.background};
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AssetInfo = styled.div`
  flex: 1;
  padding-left: 1rem;
`;

const AssetTitle = styled.h3`
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  color: ${props => props.theme.colors.text};
`;

const AssetDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const AssetMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
`;

const AssetId = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.textTertiary};
`;

const Badge = styled.span<{ type: 'owner' | 'license' }>`
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  background-color: ${props => props.type === 'owner'
    ? props.theme.colors.success + '33'
    : props.theme.colors.warning + '33'};
  color: ${props => props.type === 'owner'
    ? props.theme.colors.success
    : props.theme.colors.warning};
`;

const CardDetails = styled.div`
  padding: 0 1rem 1rem;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const DetailSection = styled.div`
  margin-bottom: 1rem;
`;

const DetailTitle = styled.h4`
  font-size: 1rem;
  margin: 1rem 0 0.5rem 0;
  color: ${props => props.theme.colors.text};
`;

const DetailRow = styled.div`
  display: flex;
  margin-bottom: 0.5rem;
`;

const Label = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.textSecondary};
  width: 100px;
`;

const Value = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text};
  flex: 1;
`;

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const Tag = styled.span`
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.textSecondary};
`;

const ActionButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ActionButton = styled(Link)`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: background-color 0.2s;
`;

const ViewButton = styled(ActionButton)`
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};

  &:hover {
    background-color: ${props => props.theme.colors.backgroundDark};
  }
`;

const LicensesButton = styled(ActionButton)`
  background-color: ${props => props.theme.colors.info + '33'};
  color: ${props => props.theme.colors.info};

  &:hover {
    background-color: ${props => props.theme.colors.info + '66'};
  }
`;

const RoyaltiesButton = styled(ActionButton)`
  background-color: ${props => props.theme.colors.success + '33'};
  color: ${props => props.theme.colors.success};

  &:hover {
    background-color: ${props => props.theme.colors.success + '66'};
  }
`;

const LicenseButton = styled(ActionButton)`
  background-color: ${props => props.theme.colors.warning + '33'};
  color: ${props => props.theme.colors.warning};

  &:hover {
    background-color: ${props => props.theme.colors.warning + '66'};
  }
`;

const IPAssetCard: React.FC<IPAssetCardProps> = ({
  asset,
  isOwner,
  isLicensed = false,
  onUpdate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasImage = asset.metadata.images && asset.metadata.images.length > 0;

  return (
    <Card isExpanded={isExpanded}>
      <CardHeader onClick={() => setIsExpanded(!isExpanded)}>
        <AssetImage hasImage={hasImage}>
          {hasImage && asset.metadata.images ? (
            <img
              src={asset.metadata.images[0].startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${asset.metadata.images[0].replace('ipfs://', '')}`
                : asset.metadata.images[0]}
              alt={asset.metadata.title}
            />
          ) : (
            <span>No Image</span>
          )}
        </AssetImage>

        <AssetInfo>
          <AssetTitle>{asset.metadata.title}</AssetTitle>
          <AssetDescription>{asset.metadata.description}</AssetDescription>

          <AssetMeta>
            <AssetId>ID: {asset.tokenId}</AssetId>
            {isOwner && <Badge type="owner">Owner</Badge>}
            {isLicensed && <Badge type="license">Licensed</Badge>}
          </AssetMeta>
        </AssetInfo>
      </CardHeader>

      {isExpanded && (
        <CardDetails>
          <DetailSection>
            <DetailTitle>Details</DetailTitle>
            <DetailRow>
              <Label>Category:</Label>
              <Value>{asset.metadata.category}</Value>
            </DetailRow>
            <DetailRow>
              <Label>Created:</Label>
              <Value>{formatDate(asset.metadata.createdAt)}</Value>
            </DetailRow>
            {asset.metadata.tags && asset.metadata.tags.length > 0 && (
              <DetailRow>
                <Label>Tags:</Label>
                <Tags>
                  {asset.metadata.tags.map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Tags>
              </DetailRow>
            )}
          </DetailSection>

          <ActionButtons>
            <ViewButton to={`/ip-asset/${asset.tokenId}`}>
              View Details
            </ViewButton>

            {isOwner && (
              <>
                <LicensesButton to={`/ip-asset/${asset.tokenId}/licenses`}>
                  Manage Licenses
                </LicensesButton>
                <RoyaltiesButton to={`/ip-asset/${asset.tokenId}/royalties`}>
                  Manage Royalties
                </RoyaltiesButton>
              </>
            )}

            {!isOwner && !isLicensed && (
              <LicenseButton to={`/marketplace/license/${asset.tokenId}`}>
                License This IP
              </LicenseButton>
            )}
          </ActionButtons>
        </CardDetails>
      )}
    </Card>
  );
};

export default IPAssetCard;
