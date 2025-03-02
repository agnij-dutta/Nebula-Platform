import { useState, useCallback, useEffect } from 'react';
import { useWeb3 } from './useWeb3';
import { ethers } from 'ethers';

export interface Listing {
    listingId: number;
    tokenId: number;
    seller: string;
    price: string;
    isActive: boolean;
    isLicense: boolean;
    licenseDuration: number;
}

export function useListings(pageSize: number = 10) {
    const { contractInterface, needsWallet, connectWallet, isNetworkSwitching } = useWeb3();
    const [listings, setListings] = useState<Listing[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const loadListings = useCallback(async (page: number = 0) => {
        if (needsWallet) {
            return;
        }
        if (!contractInterface) {
            return;
        }
        if (isNetworkSwitching) {
            return;
        }

        try {
            setIsLoading(true);
            setError('');
            
            const startId = page * pageSize;
            let newListings: Listing[] = [];
            
            try {
                newListings = await contractInterface.getActiveListings(startId, pageSize);
            } catch (err: any) {
                if (err.message.includes('Start ID too high')) {
                    setHasMore(false);
                    if (page === 0) {
                        setListings([]);
                    }
                    return;
                }
                throw err;
            }

            if (newListings.length < pageSize) {
                setHasMore(false);
            }

            if (page === 0) {
                setListings(newListings);
            } else {
                setListings(prev => [...prev, ...newListings]);
            }
            setCurrentPage(page);
        } catch (err: any) {
            console.error('Failed to load listings:', err);
            if (err.code === 'NETWORK_ERROR') {
                setError('Network connection error. Please check your internet connection.');
            } else if (err.code === 'UNSUPPORTED_NETWORK') {
                setError('Please switch to the Avalanche Fuji Testnet.');
            } else {
                setError('Could not load IP listings. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [contractInterface, pageSize, needsWallet, isNetworkSwitching]);

    const refresh = useCallback(() => {
        loadListings(0);
    }, [loadListings]);

    const purchaseListing = useCallback(async (listingId: number, price: string) => {
        if (needsWallet) {
            await connectWallet();
            return;
        }
        if (!contractInterface) {
            throw new Error('Please connect your wallet to purchase IP');
        }
        if (isNetworkSwitching) {
            throw new Error('Please wait while we switch to the correct network');
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            const tx = await contractInterface.purchaseListing(listingId, price);
            await tx.wait();
            await loadListings(currentPage);
            return true;
        } catch (err: any) {
            let errorMessage = 'Could not complete the purchase';
            
            if (err.code === 'INSUFFICIENT_FUNDS') {
                errorMessage = 'You need more AVAX to purchase this IP';
            } else if (err.code === 'USER_REJECTED') {
                errorMessage = 'You declined the transaction. Try again when ready';
            } else if (err.code === 'NETWORK_ERROR') {
                errorMessage = 'Network connection error. Please check your internet connection.';
            } else if (err.code === 'UNSUPPORTED_NETWORK') {
                errorMessage = 'Please switch to the Avalanche Fuji Testnet.';
            } else if (err.reason) {
                errorMessage = err.reason;
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [contractInterface, currentPage, loadListings, needsWallet, connectWallet, isNetworkSwitching]);

    // Automatically refresh listings when network switching is complete
    useEffect(() => {
        if (!isNetworkSwitching && contractInterface) {
            refresh();
        }
    }, [isNetworkSwitching, contractInterface]);

    return {
        listings,
        isLoading,
        error,
        hasMore,
        loadMore: () => !isLoading && !isNetworkSwitching && hasMore && loadListings(currentPage + 1),
        refresh,
        currentPage,
        purchaseListing
    };
}