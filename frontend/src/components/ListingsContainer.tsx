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
    const [purchasingId, setPurchasingId] = useState<string | null>(null);

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
                            price: typeof listing.price === 'string' 
                                ? ethers.utils.formatEther(listing.price.replace(/\.0+$/, '')) // Remove trailing .0
                                : ethers.utils.formatEther(listing.price),
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
        
        setIsPurchasing(true);
        setPurchasingId(tokenId);
        setError('');
        
        try {
            const provider = contractInterface.provider;
            
            // Check if listing is still active by getting the listing details
            try {
                const marketplace = await contractInterface.getIPMarketplace();
                const listing = await marketplace.getListing(parseInt(tokenId));
                
                if (!listing.isActive) {
                    // Refresh the listings to show updated status
                    await loadListings();
                    throw new Error('This listing is no longer available. The page has been refreshed.');
                }
            } catch (err: any) {
                console.error('Failed to check listing status:', err);
                // Refresh the listings to ensure we have the latest state
                await loadListings();
                throw new Error('Unable to verify listing status. The page has been refreshed.');
            }
            
            // Check user's balance
            const balance = await provider.getBalance(account);
            const priceWei = ethers.utils.parseEther(price);
            
            if (balance.lt(priceWei)) {
                throw new Error('Insufficient AVAX balance to purchase this IP');
            }
            
            // Execute the purchase
            await contractInterface.purchaseListing(parseInt(tokenId), price);
            
            // Show success message
            setError('');
            
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
            setPurchasingId(null);
        }
    };

    const loadMore = () => {
        setCurrentPage(prev => prev + 1);
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
            <div className="listings-header">
                <h1>IP Marketplace</h1>
                <p>Discover and acquire intellectual property tokens from creators around the world</p>
            </div>
            
            {error && <ErrorDisplay message={error} onRetry={loadListings} />}
            
            <div className="listings-grid">
                {listings.length === 0 && !loading ? (
                    <div className="no-listings">No IP listings available at the moment</div>
                ) : (
                    listings.map(listing => (
                        <div key={listing.tokenId} className="listing-card">
                            <div className="listing-image">
                                {listing.ipfsMetadata?.images && listing.ipfsMetadata.images[0] ? (
                                    <img 
                                        src={ipfsService.getIPFSUrl(listing.ipfsMetadata.images[0])}
                                        alt={listing.title}
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div className="placeholder-image"></div>
                                )}
                            </div>
                            
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
                                    <span>{listing.price} AVAX</span>
                                </div>
                                
                                <button 
                                    onClick={() => handlePurchase(listing.tokenId, listing.price)}
                                    className="purchase-button"
                                    disabled={isPurchasing || listing.owner.toLowerCase() === account?.toLowerCase()}
                                >
                                    {isPurchasing && purchasingId === listing.tokenId ? 'Processing...' : 
                                     listing.owner.toLowerCase() === account?.toLowerCase() ? 'You own this' : 
                                     'Purchase'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
                
                {loading && (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading IP listings...</p>
                    </div>
                )}
            </div>
            
            {hasMore && listings.length > 0 && !loading && (
                <button onClick={loadMore} className="load-more-button">
                    Load More
                </button>
            )}
            
            {!hasMore && listings.length > 0 && (
                <div className="no-more-listings">
                    You've reached the end of the listings
                </div>
            )}
        </div>
    );
};

export default ListingsContainer;