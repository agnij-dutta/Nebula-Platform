import React, { useEffect } from 'react';
import { useListings } from '../web3/hooks/useListings';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import WalletPrompt from './WalletPrompt';
import './ListingsContainer.css';

const ListingsContainer: React.FC = () => {
    const { needsWallet, connectWallet, isConnecting, isNetworkSwitching } = useWeb3();
    const { 
        listings, 
        isLoading, 
        error,
        hasMore, 
        loadMore, 
        refresh,
        purchaseListing
    } = useListings(10);

    const formatPrice = (price: string | ethers.BigNumber) => {
        if (ethers.BigNumber.isBigNumber(price)) {
            return ethers.utils.formatEther(price);
        }
        return ethers.utils.formatEther(price.toString());
    };

    const handlePurchase = async (listingId: number, price: string | ethers.BigNumber) => {
        try {
            await purchaseListing(listingId, price.toString());
            refresh();
        } catch (err) {
            // Error is handled by useListings hook
            console.error('Purchase failed:', err);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to browse and purchase IP tokens"
                onConnect={connectWallet}
                isLoading={isConnecting}
            />
        );
    }

    return (
        <div className="listings-container">
            {listings.map((listing) => (
                <div key={listing.listingId} className="listing-card">
                    <div className="listing-header">
                        <h3>Token #{listing.tokenId}</h3>
                        <div className="listing-type">
                            {listing.isLicense ? 
                                `License (${listing.licenseDuration} days)` : 
                                'Full Transfer'
                            }
                        </div>
                    </div>
                    
                    <div className="listing-price">
                        <span>{formatPrice(listing.price)} AVAX</span>
                    </div>
                    
                    <div className="listing-seller">
                        Seller: 
                        <span className="address">
                            {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                        </span>
                    </div>
                    
                    <button 
                        onClick={() => handlePurchase(listing.listingId, listing.price)}
                        disabled={isLoading || isNetworkSwitching}
                        className={isLoading || isNetworkSwitching ? 'loading' : ''}
                    >
                        {isNetworkSwitching 
                            ? 'Switching Network...'
                            : isLoading 
                                ? 'Processing...' 
                                : 'Purchase'}
                    </button>
                </div>
            ))}
            
            {isLoading && (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            )}
            
            {error && (
                <div className="error-container">
                    <div className="error-message">{error}</div>
                    <button onClick={refresh} className="retry-button">
                        Retry
                    </button>
                </div>
            )}
            
            {hasMore && !isLoading && !isNetworkSwitching && (
                <button onClick={loadMore} className="load-more-button">
                    Load More
                </button>
            )}
            
            {!hasMore && listings.length > 0 && (
                <div className="no-more-listings">No more listings available</div>
            )}
            
            {!hasMore && listings.length === 0 && !isLoading && (
                <div className="no-listings">No listings found</div>
            )}
        </div>
    );
};

export default ListingsContainer;