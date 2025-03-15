import React from 'react';
import './OwnedTokens.css';

interface IPDetails {
    tokenId: string;
    title: string;
    description: string;
    price: string;
    isListed: boolean;
    creator: string;
    licenseTerms: string;
}

interface OwnedTokensProps {
    tokens: IPDetails[];
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
                        <p className="description">{token.description}</p>
                        {token.isListed && (
                            <div className="listed-badge">Already Listed</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OwnedTokens;