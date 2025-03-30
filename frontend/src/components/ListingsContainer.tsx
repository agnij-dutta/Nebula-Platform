import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import { IPTokenData } from '../types/ipTokens';
import WalletPrompt from './WalletPrompt';
import ErrorDisplay from './ErrorDisplay';
import './ListingsContainer.css';

const ITEMS_PER_PAGE = 12;

const ListingsContainer: React.FC = () => {
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [listings, setListings] = useState<IPTokenData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);

    const loadListings = useCallback(async () => {
        if (!contractInterface) return;
        
        try {
            setLoading(true);
            setError(null);
            
            const startId = currentPage * ITEMS_PER_PAGE;
            const activeListings = await contractInterface.getActiveListings(startId, ITEMS_PER_PAGE);
            
            const processedListings = await Promise.all(
                activeListings.map(async (listing: any) => {
                    try {
                        // Get the IP token details
                        const ipToken = await contractInterface.getIPToken();
                        const details = await ipToken.ipDetails(listing.tokenId);
                        
                        const tokenData: IPTokenData = {
                            tokenId: listing.tokenId.toString(),
                            title: details.title || 'Untitled IP',
                            description: details.description || 'No description available',
                            price: ethers.utils.formatEther(listing.price),
                            isListed: true,
                            creator: details.creator,
                            licenseTerms: details.licenseTerms,
                            owner: listing.seller,
                            isLoadingMetadata: false
                        };

                        // Fetch IPFS metadata if available
                        if (details.uri && details.uri !== '') {
                            try {
                                tokenData.isLoadingMetadata = true;
                                const metadata = await ipfsService.getIPMetadata(details.uri);
                                tokenData.ipfsMetadata = metadata;
                            } catch (err) {
                                console.warn(`Failed to load IPFS metadata for token ${listing.tokenId}:`, err);
                                tokenData.metadataError = 'Failed to load additional metadata';
                            } finally {
                                tokenData.isLoadingMetadata = false;
                            }
                        }

                        return tokenData;
                    } catch (err) {
                        console.warn(`Failed to process listing ${listing.tokenId}:`, err);
                        return null;
                    }
                })
            );

            const validListings = processedListings.filter((listing): listing is IPTokenData => listing !== null);
            
            setListings(prevListings => 
                currentPage === 0 ? validListings : [...prevListings, ...validListings]
            );
            setHasMore(validListings.length === ITEMS_PER_PAGE);
            
        } catch (err: any) {
            console.error('Failed to load listings:', err);
            let errorMessage = 'Failed to load IP listings';
            
            if (err?.code === -32603 || err?.message?.includes('network')) {
                errorMessage = 'Network connection error. Please check your connection and try again.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [contractInterface, currentPage]);

    useEffect(() => {
        loadListings();
    }, [loadListings]);

    const handlePurchase = async (tokenId: string, price: string) => {
        if (!contractInterface || !account) return;
        
        try {
            setIsPurchasing(true);
            setError(null);
            
            // First check if we have enough balance
            const provider = await contractInterface.provider;
            const balance = await provider.getBalance(account);
            const priceWei = ethers.utils.parseEther(price);
            
            if (balance.lt(priceWei)) {
                throw new Error('Insufficient AVAX balance to purchase this IP');
            }
            
            // Execute the purchase
            await contractInterface.purchaseListing(parseInt(tokenId), price);
            
            // Refresh the listings
            setCurrentPage(0);
            await loadListings();
            
        } catch (err: any) {
            console.error('Purchase failed:', err);
            let errorMessage = 'Failed to purchase IP token';
            
            if (err?.code === 'INSUFFICIENT_FUNDS') {
                errorMessage = 'Insufficient AVAX balance to purchase this IP';
            } else if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
                errorMessage = 'Transaction was rejected. Please try again.';
            } else if (err?.code === -32603 || err?.message?.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (err?.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        } finally {
            setIsPurchasing(false);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to browse IP listings"
                onConnect={connectWallet}
            />
        );
    }

    return (
        <div className="listings-container">
            <h1>IP Marketplace</h1>
            {error && <ErrorDisplay message={error} onRetry={loadListings} />}
            
            <div className="listings-grid">
                {listings.map(listing => (
                    <div key={listing.tokenId} className="listing-card">
                        {listing.ipfsMetadata?.images && listing.ipfsMetadata.images[0] && (
                            <div className="listing-image">
                                <img 
                                    src={ipfsService.getIPFSUrl(listing.ipfsMetadata.images[0])}
                                    alt={listing.title}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                        
                        <div className="listing-content">
                            <h3>{listing.title}</h3>
                            <p className="description">
                                {listing.ipfsMetadata?.description || listing.description}
                            </p>
                            
                            {listing.ipfsMetadata?.additionalDetails?.tags && (
                                <div className="tags">
                                    {listing.ipfsMetadata.additionalDetails.tags.map((tag, index) => (
                                        <span key={index} className="tag">{tag}</span>
                                    ))}
                                </div>
                            )}
                            
                            <div className="price">
                                <span>Price: {listing.price} AVAX</span>
                            </div>
                            
                            <button 
                                onClick={() => handlePurchase(listing.tokenId, listing.price)}
                                className="purchase-button"
                                disabled={isPurchasing || listing.owner.toLowerCase() === account?.toLowerCase()}
                            >
                                {isPurchasing ? 'Processing...' : 
                                 listing.owner.toLowerCase() === account?.toLowerCase() ? 'You own this' : 
                                 'Purchase'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            {loading && <div className="loading">Loading listings...</div>}
            
            {hasMore && !loading && (
                <button 
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="load-more"
                >
                    Load More
                </button>
            )}
        </div>
    );
};

export default ListingsContainer;