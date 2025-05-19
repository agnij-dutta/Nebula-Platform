import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import { IPTokenData } from '../types/ipTokens';
import WalletPrompt from './WalletPrompt';
import ErrorDisplay from './ErrorDisplay';
import { useNavigate } from 'react-router-dom';
import './ListingsContainer.css';

const ITEMS_PER_PAGE = 12;

const ListingsContainer: React.FC = () => {
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [listings, setListings] = useState<IPTokenData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchasingId, setPurchasingId] = useState<string | null>(null);
    const navigate = useNavigate();

    const loadListings = useCallback(async () => {
        if (!contractInterface) return;

        try {
            setLoading(true);
            setError(null);
            setSuccessMessage(false);

            const startId = currentPage * ITEMS_PER_PAGE;
            const activeListings = await contractInterface.getActiveListings(startId, ITEMS_PER_PAGE);

            const processedListings = await Promise.all(
                activeListings.map(async (listing: any) => {
                    try {
                        // Get the IP token details
                        const ipToken = await contractInterface.getIPToken();
                        const details = await ipToken.ipDetails(listing.tokenId);

                        // Handle price formatting safely
                        let formattedPrice;
                        try {
                            if (typeof listing.price === 'string') {
                                // Remove trailing .0 if present
                                const cleanedPrice = listing.price.replace(/\.0+$/, '');
                                formattedPrice = ethers.utils.formatEther(cleanedPrice);
                            } else if (typeof listing.price === 'object' && 'toString' in listing.price) {
                                formattedPrice = ethers.utils.formatEther(listing.price.toString());
                            } else if (typeof listing.price === 'number') {
                                // Handle direct number values (like 0.00001)
                                formattedPrice = listing.price.toString();
                            } else {
                                formattedPrice = ethers.utils.formatEther(listing.price);
                            }
                        } catch (err) {
                            console.warn(`Error formatting price for listing ${listing.tokenId}:`, err);
                            // Fallback to the original price value as a string
                            formattedPrice = listing.price.toString();
                        }

                        const tokenData: IPTokenData = {
                            tokenId: listing.tokenId.toString(),
                            title: details.title || 'Untitled IP',
                            description: details.description || 'No description available',
                            price: formattedPrice,
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

            // Filter out null listings
            const validListings = processedListings.filter((listing): listing is IPTokenData => listing !== null);

            // Filter out listings that the user already owns
            const filteredListings = validListings.filter(listing => {
                return !account || listing.owner.toLowerCase() !== account.toLowerCase();
            });

            setListings(prevListings =>
                currentPage === 0 ? filteredListings : [...prevListings, ...filteredListings]
            );
            setHasMore(filteredListings.length === ITEMS_PER_PAGE);

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
    }, [contractInterface, currentPage, account]);

    useEffect(() => {
        loadListings();
    }, [loadListings]);

    const handlePurchase = async (tokenId: string, price: string) => {
        if (!contractInterface || !account) return;

        setIsPurchasing(true);
        setPurchasingId(tokenId);
        setError('');
        setSuccessMessage(false);

        try {
            console.log(`Starting purchase for token ID ${tokenId} with price ${price} AVAX`);
            const provider = contractInterface.provider;
            // Get signer but only log it for debugging
            contractInterface.getSigner();

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

            // Format values for logging
            const formattedBalance = ethers.utils.formatEther(balance);
            const formattedListingPrice = ethers.utils.formatEther(listingPrice);
            const formattedGasCost = ethers.utils.formatEther(estimatedGasCost);
            const formattedTotalRequired = ethers.utils.formatEther(totalRequired);

            console.log('Purchase validation:', {
                balance: formattedBalance,
                listingPrice: formattedListingPrice,
                estimatedGasCost: formattedGasCost,
                totalRequired: formattedTotalRequired,
                sufficientBalance: balance.gte(totalRequired)
            });

            if (balance.lt(totalRequired)) {
                // Format the balance and required amount to a more readable format
                const displayBalance = parseFloat(formattedBalance).toFixed(6);
                const displayRequired = parseFloat(formattedTotalRequired).toFixed(6);
                throw new Error(`Insufficient AVAX balance (${displayBalance} AVAX) to purchase this IP and cover gas costs (${displayRequired} AVAX required)`);
            }

            // Execute the purchase directly using the raw contract
            try {
                console.log(`Sending transaction with manual gas limit: ${manualGasLimit.toString()}`);

                // Instead of creating a direct contract instance, use the contractInterface
                // This ensures we're using the same contract instance with all the proper error handling

                // Call the purchaseListing method from the contractInterface
                const tx = await contractInterface.purchaseListing(parseInt(tokenId), ethers.utils.formatEther(listingPrice));

                console.log('Purchase transaction sent:', tx);

                // Check if tx has a wait method before calling it
                let receipt;
                if (tx && typeof tx.wait === 'function') {
                    receipt = await tx.wait();
                    console.log('Purchase successful:', receipt);
                } else {
                    console.log('Transaction object does not have wait method, waiting for confirmation manually');
                    // Wait for a few seconds to allow the transaction to be processed
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    console.log('Continued after waiting for transaction confirmation');
                }

                // Refresh the listings
                setCurrentPage(0);

                // Force a delay to allow the blockchain to update
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Remove the purchased listing from the local state
                setListings(prevListings =>
                    prevListings.filter(item => item.tokenId !== tokenId)
                );

                // Show success message
                setError("Purchase successful! Redirecting to your IP portfolio...");
                setSuccessMessage(true);

                // Reload all listings to ensure we have the latest data
                await loadListings();

                // Navigate to the dashboard after a short delay
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
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

            {error && <ErrorDisplay
                message={error}
                onRetry={successMessage ? undefined : loadListings}
                type={successMessage ? 'success' : 'error'}
            />}

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
                                    <span>
                                        {(() => {
                                            // Parse the price as a float
                                            const priceValue = parseFloat(listing.price);

                                            // Adjust display based on the value
                                            if (priceValue < 0.0001) {
                                                return priceValue.toExponential(2);
                                            } else if (priceValue < 0.001) {
                                                return priceValue.toFixed(6);
                                            } else if (priceValue < 0.01) {
                                                return priceValue.toFixed(5);
                                            } else if (priceValue < 0.1) {
                                                return priceValue.toFixed(4);
                                            } else if (priceValue < 1) {
                                                return priceValue.toFixed(3);
                                            } else if (priceValue < 1000) {
                                                return priceValue.toFixed(2);
                                            } else {
                                                return priceValue.toLocaleString(undefined, {
                                                    maximumFractionDigits: 2
                                                });
                                            }
                                        })()}
                                        {' AVAX'}
                                    </span>
                                </div>

                                <button
                                    onClick={() => handlePurchase(listing.tokenId, listing.price)}
                                    className="purchase-button"
                                    disabled={isPurchasing || (!!account && listing.owner.toLowerCase() === account.toLowerCase())}
                                >
                                    {isPurchasing && purchasingId === listing.tokenId ? 'Processing...' :
                                     (!!account && listing.owner.toLowerCase() === account.toLowerCase()) ? 'YOU OWN THIS' :
                                     'PURCHASE'}
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