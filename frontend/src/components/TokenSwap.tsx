import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { WEB3_CONFIG } from '../web3/config';
import WalletPrompt from './WalletPrompt';
import './TokenSwap.css';

const TokenSwap = () => {
    const { contractInterface, account, needsWallet, connectWallet, chainId, isNetworkSwitching } = useWeb3();
    const [avaxAmount, setAvaxAmount] = useState('');
    const [expectedNebl, setExpectedNebl] = useState('0');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [neblBalance, setNeblBalance] = useState('0');
    const [success, setSuccess] = useState(false);

    const updateBalance = useCallback(async () => {
        if (!contractInterface || !account || chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
            setNeblBalance('0');
            return;
        }

        try {
            const balance = await contractInterface.getNeblBalance(account);
            setNeblBalance(ethers.utils.formatEther(balance));
            setError(''); // Clear any previous errors
        } catch (err: any) {
            console.error('Failed to get NEBL balance:', err);
            setNeblBalance('0');
            // Don't show initialization errors to user, they'll see network overlay if needed
            if (!err.message.includes('network') && !err.message.includes('contract')) {
                setError(err.message);
            }
        }
    }, [contractInterface, account, chainId]);

    useEffect(() => {
        if (chainId === WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
            updateBalance();
            // Poll for balance updates
            const interval = setInterval(updateBalance, 10000);
            return () => clearInterval(interval);
        }
    }, [updateBalance, chainId]);

    const calculateExpectedAmount = useCallback(async (amount: string) => {
        if (!contractInterface || !amount || isNaN(Number(amount))) {
            setExpectedNebl('0');
            return;
        }

        try {
            const expectedAmount = await contractInterface.calculateExpectedNEBL(amount);
            setExpectedNebl(ethers.utils.formatEther(expectedAmount));
            setError('');
        } catch (err: any) {
            console.error('Failed to calculate NEBL amount:', err);
            setExpectedNebl('0');
            // Only show relevant errors to user
            if (!err.message.includes('network') && !err.message.includes('contract')) {
                setError('Failed to calculate expected NEBL amount');
            }
        }
    }, [contractInterface]);

    useEffect(() => {
        calculateExpectedAmount(avaxAmount);
    }, [avaxAmount, calculateExpectedAmount]);

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account) return;

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const receipt = await contractInterface.swapAVAXForNEBL(avaxAmount);
            
            if (receipt.status === 1) {
                setAvaxAmount('');
                setExpectedNebl('0');
                setSuccess(true);
                
                // Update balance with retry logic
                let retries = 3;
                const retryBalance = async () => {
                    try {
                        await updateBalance();
                    } catch (err) {
                        if (retries > 0) {
                            retries--;
                            setTimeout(retryBalance, 2000);
                        }
                    }
                };
                await retryBalance();
            }
        } catch (err: any) {
            console.error('Swap failed:', err);
            if (err.code === 4001) {
                setError('Transaction rejected by user');
            } else if (err.message.includes('insufficient liquidity')) {
                setError('Insufficient liquidity in swap contract');
            } else if (!err.message.includes('network')) {
                setError(err.message || 'Failed to swap tokens');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (/^\d*\.?\d*$/.test(value) && !isNaN(Number(value)))) {
            setAvaxAmount(value);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to swap tokens"
                onConnect={connectWallet}
            />
        );
    }

    const isWrongNetwork = chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId;

    return (
        <div className={`token-swap ${loading ? 'loading' : ''}`}>
            <div className="swap-animation">
                <h1>Swap AVAX for NEBL</h1>
                
                <div className={`network-status ${isWrongNetwork ? 'wrong-network' : ''}`}>
                    <div className={`network-indicator ${isWrongNetwork ? 'wrong-network' : 'connected'}`}></div>
                    <span>
                        {isWrongNetwork ? 'Please switch to Fuji Testnet' : 'Connected to Fuji Testnet'}
                    </span>
                </div>

                <div className={`balance-info ${isNetworkSwitching ? 'updating' : ''}`}>
                    <p>Your NEBL Balance: {parseFloat(neblBalance).toFixed(4)} NEBL</p>
                    {isNetworkSwitching && <div className="loading-spinner"></div>}
                </div>

                {error && <div className="error">{error}</div>}
                {success && (
                    <div className="success">
                        Swap completed successfully! Your NEBL balance will update shortly.
                    </div>
                )}
                
                <form onSubmit={handleSwap} className="swap-form">
                    <div className="input-group">
                        <label>AVAX Amount</label>
                        <input
                            type="text"
                            value={avaxAmount}
                            onChange={handleAmountChange}
                            placeholder="Enter AVAX amount"
                            disabled={isWrongNetwork || loading || isNetworkSwitching}
                            aria-label="AVAX amount to swap"
                        />
                    </div>
                    
                    <div className="expected-return" role="status" aria-live="polite">
                        Expected NEBL: {parseFloat(expectedNebl).toFixed(4)}
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading || !avaxAmount || isWrongNetwork || isNetworkSwitching}
                        aria-busy={loading}
                    >
                        {loading ? 'Processing...' : 
                         isWrongNetwork ? 'Wrong Network' :
                         isNetworkSwitching ? 'Switching Network...' : 
                         'Swap AVAX for NEBL'}
                    </button>
                </form>

                {loading && (
                    <div className="loading-overlay" role="alert" aria-busy="true">
                        <div className="loading-spinner"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TokenSwap;