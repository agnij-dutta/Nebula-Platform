import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import OwnedTokens from './OwnedTokens';
import './CreateListing.css';

export interface CreateListingProps {
    onListingCreated: () => void;
    initialTokenId?: string | null;
}

const CreateListing: React.FC<CreateListingProps> = ({ onListingCreated, initialTokenId }) => {
    const { contractInterface, account } = useWeb3();
    const [tokenId, setTokenId] = useState(initialTokenId || '');
    const [price, setPrice] = useState('');
    const [isLicense, setIsLicense] = useState(false);
    const [licenseDuration, setLicenseDuration] = useState('30'); // Default 30 days
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [ownedTokens, setOwnedTokens] = useState<Array<any>>([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);

    // Set the token ID when initialTokenId is provided
    useEffect(() => {
        if (initialTokenId) {
            setTokenId(initialTokenId);
        }
    }, [initialTokenId]);

    // Load owned tokens when component mounts
    useEffect(() => {
        const loadOwnedTokens = async () => {
            if (contractInterface && account) {
                setIsLoadingTokens(true);
                try {
                    const tokens = await contractInterface.getOwnedTokens(account);
                    setOwnedTokens(tokens);
                } catch (err) {
                    console.error('Failed to load owned tokens:', err);
                } finally {
                    setIsLoadingTokens(false);
                }
            }
        };

        loadOwnedTokens();
    }, [contractInterface, account]);

    const handleTokenSelect = (selectedTokenId: string) => {
        setTokenId(selectedTokenId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account) {
            setError('Web3 not initialized');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            // First, check if the token exists and get its owner
            const ipToken = await contractInterface.getIPToken();
            try {
                const owner = await ipToken.ownerOf(parseInt(tokenId));

                // Check if the current user owns the token
                if (owner.toLowerCase() !== account.toLowerCase()) {
                    setError('You do not own this token');
                    return;
                }

                // Check if the marketplace is approved
                const isApproved = await ipToken.isApprovedForAll(owner, contractInterface.getIPMarketplaceAddress());

                if (!isApproved) {
                    // Request approval first
                    const approveTx = await ipToken.setApprovalForAll(contractInterface.getIPMarketplaceAddress(), true);
                    await approveTx.wait(1); // Wait for 1 confirmation
                }

                // Now create the listing
                const durationInSeconds = isLicense ? parseInt(licenseDuration) * 24 * 60 * 60 : 0;

                // Make sure price is a valid number
                const priceValue = parseFloat(price);
                if (isNaN(priceValue)) {
                    throw new Error('Please enter a valid price');
                }

                if (priceValue <= 0) {
                    throw new Error('Price must be greater than 0');
                }

                if (priceValue < 0.000001) {
                    throw new Error('Minimum price is 0.000001 AVAX');
                }

                // Format price to ensure it's a proper string representation
                const formattedPrice = priceValue.toString();

                console.log("Creating listing with params:", {
                    tokenId: parseInt(tokenId),
                    price: formattedPrice,
                    isLicense,
                    durationInSeconds
                });

                const result = await contractInterface.createListing(
                    parseInt(tokenId),
                    formattedPrice, // Pass the formatted price as a string
                    isLicense,
                    durationInSeconds
                );

                console.log("Listing creation result:", result);

                // Clear form
                setTokenId('');
                setPrice('');
                setIsLicense(false);
                setLicenseDuration('30');

                // Notify parent component
                onListingCreated();
            } catch (err: any) {
                if (err.message.includes("invalid token ID")) {
                    setError('Token ID does not exist. Please create an IP token first.');
                } else if (err.message.includes("caller is not token owner")) {
                    setError('You do not own this token');
                } else {
                    throw err;
                }
            }
        } catch (err: any) {
            let errorMessage = 'Failed to create listing';

            if (err.code === 'INSUFFICIENT_FUNDS') {
                errorMessage = 'Insufficient AVAX for gas fees';
            } else if (err.code === 'USER_REJECTED') {
                errorMessage = 'Transaction rejected by user';
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="create-listing">
            <h2>Create New Listing</h2>
            {error && (
                <div className="error-message">
                    <div className="error-icon">⚠️</div>
                    <div className="error-text">{error}</div>
                </div>
            )}

            <OwnedTokens
                tokens={ownedTokens}
                onTokenSelect={handleTokenSelect}
                selectedTokenId={tokenId}
                isLoading={isLoadingTokens}
            />

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="tokenId">Token ID</label>
                    <input
                        id="tokenId"
                        type="number"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                        required
                        min="1"
                        disabled={isLoading || !!initialTokenId}
                    />
                    {initialTokenId && (
                        <small className="help-text">Using newly created IP token</small>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="price">Price (AVAX)</label>
                    <input
                        id="price"
                        type="number"
                        value={price}
                        onChange={(e) => {
                            // Validate and format the price input
                            const inputValue = e.target.value;
                            const numValue = parseFloat(inputValue);

                            // Allow empty string for user to clear the field
                            if (inputValue === '' || !isNaN(numValue)) {
                                setPrice(inputValue);
                            }
                        }}
                        required
                        min="0.000001"
                        step="0.000001"
                        placeholder="0.00"
                        disabled={isLoading}
                    />
                    <small className="help-text">Minimum price: 0.000001 AVAX</small>
                </div>

                <div className="form-group checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={isLicense}
                            onChange={(e) => setIsLicense(e.target.checked)}
                            disabled={isLoading}
                        />
                        List as License
                    </label>
                </div>

                {isLicense && (
                    <div className="form-group">
                        <label htmlFor="licenseDuration">License Duration (days)</label>
                        <input
                            id="licenseDuration"
                            type="number"
                            value={licenseDuration}
                            onChange={(e) => setLicenseDuration(e.target.value)}
                            required
                            min="1"
                            disabled={isLoading}
                        />
                    </div>
                )}

                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Listing'}
                </button>
            </form>
        </div>
    );
};

export default CreateListing;