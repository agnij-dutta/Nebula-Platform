import React from 'react';
import { IPTokenData } from '../types/ipTokens';
import { ipfsService } from '../web3/utils/ipfs';
import './OwnedTokens.css';

interface OwnedTokensProps {
    tokens: IPTokenData[];
    onTokenSelect: (tokenId: string) => void;
    selectedTokenId?: string;
    isLoading: boolean;
}

const OwnedTokens: React.FC<OwnedTokensProps> = ({ tokens, onTokenSelect, selectedTokenId, isLoading }) => {
    if (isLoading) {
        return (
            <div className="owned-tokens">
                <div className="loading">Loading your tokens...</div>
            </div>
        );
    }

    if (tokens.length === 0) {
        return (
            <div className="owned-tokens">
                <div className="no-tokens">
                    You don't own any IP tokens yet. Create one first!
                </div>
            </div>
        );
    }

    return (
        <div className="owned-tokens">
            <h3>Your IP Tokens</h3>
            <div className="token-list">
                {tokens.map(token => (
                    <div 
                        key={token.tokenId}
                        className={`token-card ${selectedTokenId === token.tokenId ? 'selected' : ''}`}
                        onClick={() => onTokenSelect(token.tokenId)}
                    >
                        <h4>{token.title}</h4>
                        <p className="token-id">Token ID: {token.tokenId}</p>
                        <p className="description">
                            {token.ipfsMetadata?.description || token.description}
                        </p>
                        {token.ipfsMetadata?.images && token.ipfsMetadata.images.length > 0 && (
                            <div className="token-image">
                                <img 
                                    src={ipfsService.getIPFSUrl(token.ipfsMetadata.images[0])} 
                                    alt={token.title}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                        {token.isListed && (
                            <div className="listed-badge">Already Listed</div>
                        )}
                        {token.ipfsMetadata?.additionalDetails?.tags && (
                            <div className="token-tags">
                                {token.ipfsMetadata.additionalDetails.tags.map((tag, index) => (
                                    <span key={index} className="tag">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OwnedTokens;