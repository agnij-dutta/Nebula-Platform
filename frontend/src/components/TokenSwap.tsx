import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import { WEB3_CONFIG } from '../web3/config';
import WalletPrompt from './WalletPrompt';
import './TokenSwap.css';

const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toFixed(1);
};

const TokenSwap = () => {
    const { contractInterface, account, needsWallet, connectWallet, chainId, isNetworkSwitching, isWrongNetwork } = useWeb3Context();
    const [avaxAmount, setAvaxAmount] = useState('');
    const [neblAmount, setNeblAmount] = useState('');
    const [expectedNebl, setExpectedNebl] = useState('0');
    const [expectedAvax, setExpectedAvax] = useState('0');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [neblBalance, setNeblBalance] = useState('0');
    const [success, setSuccess] = useState(false);
    const [swapDirection, setSwapDirection] = useState<'avax-to-nebl' | 'nebl-to-avax'>('avax-to-nebl');

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
            setExpectedAvax('0');
            return;
        }

        try {
            if (swapDirection === 'avax-to-nebl') {
                const expectedAmount = await contractInterface.calculateExpectedNEBL(amount);
                setExpectedNebl(ethers.utils.formatEther(expectedAmount));
            } else {
                const expectedAmount = await contractInterface.calculateExpectedAVAX(amount);
                setExpectedAvax(ethers.utils.formatEther(expectedAmount));
            }
            setError('');
        } catch (err: any) {
            console.error('Failed to calculate expected amount:', err);
            setExpectedNebl('0');
            setExpectedAvax('0');
            // Only show relevant errors to user
            if (!err.message.includes('network') && !err.message.includes('contract')) {
                setError('Failed to calculate expected amount');
            }
        }
    }, [contractInterface, swapDirection]);

    useEffect(() => {
        if (swapDirection === 'avax-to-nebl') {
            calculateExpectedAmount(avaxAmount);
        } else {
            calculateExpectedAmount(neblAmount);
        }
    }, [avaxAmount, neblAmount, calculateExpectedAmount, swapDirection]);

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account) return;

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            let receipt;
            if (swapDirection === 'avax-to-nebl') {
                receipt = await contractInterface.swapAVAXForNEBL(avaxAmount);
            } else {
                receipt = await contractInterface.swapNEBLForAVAX(neblAmount);
            }
            
            if (receipt.status === 1) {
                setAvaxAmount('');
                setNeblAmount('');
                setExpectedNebl('0');
                setExpectedAvax('0');
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
            if (swapDirection === 'avax-to-nebl') {
                setAvaxAmount(value);
            } else {
                setNeblAmount(value);
            }
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



    return (
        <div className={`token-swap ${loading ? 'loading' : ''}`}>
            <div className="swap-animation">
                <h1>Swap {swapDirection === 'avax-to-nebl' ? 'AVAX for NEBL' : 'NEBL for AVAX'}</h1>
                
                <div className="swap-direction-toggle">
                    <button
                        className={swapDirection === 'avax-to-nebl' ? 'active' : ''}
                        onClick={() => setSwapDirection('avax-to-nebl')}
                        disabled={loading || isWrongNetwork || isNetworkSwitching}
                    >
                        AVAX → NEBL
                    </button>
                    <button
                        className={swapDirection === 'nebl-to-avax' ? 'active' : ''}
                        onClick={() => setSwapDirection('nebl-to-avax')}
                        disabled={loading || isWrongNetwork || isNetworkSwitching}
                    >
                        NEBL → AVAX
                    </button>
                </div>
                
                <div className={`network-status ${isWrongNetwork ? 'wrong-network' : ''}`}>
                    <div className={`network-indicator ${isWrongNetwork ? 'wrong-network' : 'connected'}`}></div>
                    <span>
                        {isWrongNetwork ? 'Please switch to Fuji Testnet' : 'Connected to Fuji Testnet'}
                    </span>
                </div>

                <div className={`balance-info ${isNetworkSwitching ? 'updating' : ''}`}>
                    <p>Your NEBL Balance: {formatNumber(parseFloat(neblBalance))} NEBL</p>
                    {isNetworkSwitching && <div className="loading-spinner"></div>}
                </div>

                {error && <div className="error">{error}</div>}
                {success && (
                    <div className="success">
                        Swap completed successfully! Your balance will update shortly.
                    </div>
                )}
                
                <form onSubmit={handleSwap} className="swap-form">
                    <div className="input-group">
                        <label>{swapDirection === 'avax-to-nebl' ? 'AVAX Amount' : 'NEBL Amount'}</label>
                        <input
                            type="text"
                            value={swapDirection === 'avax-to-nebl' ? avaxAmount : neblAmount}
                            onChange={handleAmountChange}
                            placeholder={`Enter ${swapDirection === 'avax-to-nebl' ? 'AVAX' : 'NEBL'} amount`}
                            disabled={isWrongNetwork || loading || isNetworkSwitching}
                            aria-label={`${swapDirection === 'avax-to-nebl' ? 'AVAX' : 'NEBL'} amount to swap`}
                        />
                    </div>
                    
                    <div className="expected-return" role="status" aria-live="polite">
                        Expected {swapDirection === 'avax-to-nebl' ? 'NEBL' : 'AVAX'}: {formatNumber(parseFloat(swapDirection === 'avax-to-nebl' ? expectedNebl : expectedAvax))}
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading || (swapDirection === 'avax-to-nebl' ? !avaxAmount : !neblAmount) || isWrongNetwork || isNetworkSwitching}
                        aria-busy={loading}
                    >
                        {loading ? 'Processing...' : 
                         isWrongNetwork ? 'Wrong Network' :
                         isNetworkSwitching ? 'Switching Network...' : 
                         `Swap ${swapDirection === 'avax-to-nebl' ? 'AVAX for NEBL' : 'NEBL for AVAX'}`}
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