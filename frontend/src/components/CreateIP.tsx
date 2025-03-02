import React, { useState } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import WalletPrompt from './WalletPrompt';
import './CreateIP.css';

interface CreateIPProps {
    onIPCreated: (tokenId: string) => void;
}

const CreateIP: React.FC<CreateIPProps> = ({ onIPCreated }) => {
    const { contractInterface, needsWallet, connectWallet, isConnecting } = useWeb3();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [uri, setUri] = useState('');
    const [licenseTerms, setLicenseTerms] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const tokenId = await contractInterface!.createIP(
                title,
                description,
                uri,
                licenseTerms
            );
            
            // Clear form
            setTitle('');
            setDescription('');
            setUri('');
            setLicenseTerms('');
            
            // Notify parent component
            onIPCreated(tokenId);
        } catch (err: any) {
            let errorMessage = 'Could not create IP token';
            
            if (err.code === 'INSUFFICIENT_FUNDS') {
                errorMessage = 'You need AVAX in your wallet to create an IP token';
            } else if (err.code === 'USER_REJECTED') {
                errorMessage = 'You declined the transaction. Try again when ready';
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to create and tokenize your IP"
                onConnect={connectWallet}
                isLoading={isConnecting}
            />
        );
    }

    return (
        <div className="create-ip">
            <h2>Create New IP Token</h2>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="title">Title</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="uri">URI (IPFS or other content link)</label>
                    <input
                        id="uri"
                        type="text"
                        value={uri}
                        onChange={(e) => setUri(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="licenseTerms">License Terms</label>
                    <textarea
                        id="licenseTerms"
                        value={licenseTerms}
                        onChange={(e) => setLicenseTerms(e.target.value)}
                        required
                        disabled={isLoading}
                        placeholder="Enter the terms under which this IP can be licensed..."
                    />
                </div>

                <button type="submit" disabled={isLoading}>
                    {needsWallet 
                        ? 'Connect Wallet to Create IP' 
                        : isLoading 
                            ? 'Creating...' 
                            : 'Create IP Token'}
                </button>
            </form>
        </div>
    );
};

export default CreateIP;