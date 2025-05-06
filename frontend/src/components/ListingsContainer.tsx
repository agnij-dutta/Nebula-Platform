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
            console.log(`Starting purchase for token ID ${tokenId} with price ${price} AVAX`);
            const provider = contractInterface.provider;
            const signer = contractInterface.getSigner();
            
            // Get the marketplace contract address
            const marketplaceAddress = contractInterface.getIPMarketplaceAddress();
            console.log(`IPMarketplace address: ${marketplaceAddress}`);
            
            // Get the marketplace contract
            const marketplace = await contractInterface.getIPMarketplace();
            
            // Check if listing is still active
            console.log(`Checking listing status for ID ${tokenId}`);
            const listing = await marketplace.getListing(parseInt(tokenId));
            console.log('Listing data:', {
                listingId: listing.listingId.toString(),
                tokenId: listing.tokenId.toString(),
                price: ethers.utils.formatEther(listing.price),
                isActive: listing.isActive,
                seller: listing.seller
            });
            
            if (!listing.isActive) {
                await loadListings();
                throw new Error('This listing is no longer available. The page has been refreshed.');
            }
            
            // Check user's balance
            const balance = await provider.getBalance(account);
            const listingPrice = listing.price;
            
            // Use manual gas limit to bypass estimation issues
            const manualGasLimit = ethers.BigNumber.from('500000'); // Conservative gas limit
            const gasPrice = await provider.getGasPrice();
            const estimatedGasCost = manualGasLimit.mul(gasPrice);
            
            // Add gas cost to the price to get total required
            const totalRequired = listingPrice.add(estimatedGasCost);
            
            console.log('Purchase validation:', {
                balance: ethers.utils.formatEther(balance),
                listingPrice: ethers.utils.formatEther(listingPrice),
                estimatedGasCost: ethers.utils.formatEther(estimatedGasCost),
                totalRequired: ethers.utils.formatEther(totalRequired),
                sufficientBalance: balance.gte(totalRequired)
            });
            
            if (balance.lt(totalRequired)) {
                throw new Error(`Insufficient AVAX balance (${ethers.utils.formatEther(balance)} AVAX) to purchase this IP and cover gas costs (${ethers.utils.formatEther(totalRequired)} AVAX required)`);
            }
            
            // Execute the purchase directly using the raw contract
            try {
                console.log(`Sending transaction with manual gas limit: ${manualGasLimit.toString()}`);
                
                // Create a direct contract instance
                const marketplaceContract = new ethers.Contract(
                    marketplaceAddress,
                    [
                        "function purchaseListing(uint256 listingId) external payable",
                        "function getListing(uint256 listingId) external view returns (uint256 listingId, uint256 tokenId, address seller, uint256 price, bool isActive, bool isLicense, uint256 licenseDuration)"
                    ],
                    signer
                );
                
                // Send transaction with exact listing price
                const tx = await marketplaceContract.purchaseListing(parseInt(tokenId), {
                    value: listingPrice,
                    gasLimit: manualGasLimit,
                    gasPrice: gasPrice
                });
                
                console.log('Purchase transaction sent:', tx.hash);
                const receipt = await tx.wait();
                console.log('Purchase successful:', receipt);
                
                // Refresh the listings
                setCurrentPage(0);
                await loadListings();
            } catch (err: any) {
                console.error('Purchase transaction failed:', err);
                let errorMessage = 'Failed to purchase IP token';
                
                if (err?.code === 'INSUFFICIENT_FUNDS') {
                    errorMessage = 'Insufficient AVAX balance to purchase this IP';
                } else if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
                    errorMessage = 'Transaction was rejected. Please try again.';
                } else if (err?.code === -32603) {
                    if (err?.data?.message?.includes('execution reverted')) {
                        errorMessage = 'Transaction failed: ' + err.data.message;
                    } else {
                        errorMessage = 'Transaction failed. Please check your network connection and try again.';
                    }
                } else if (err?.message?.includes('network')) {
                    errorMessage = 'Network error. Please check your connection and try again.';
                } else if (err?.message) {
                    errorMessage = err.message;
                }
                
                setError(errorMessage);
            }
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