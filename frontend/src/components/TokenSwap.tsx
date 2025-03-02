import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import WalletPrompt from './WalletPrompt';
import './TokenSwap.css';

const TokenSwap = () => {
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [avaxAmount, setAvaxAmount] = useState('');
    const [expectedNebl, setExpectedNebl] = useState('0');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [neblBalance, setNeblBalance] = useState('0');
    const [success, setSuccess] = useState(false);

    const updateBalance = useCallback(async () => {
        if (!contractInterface || !account) return;
        try {
            const neblToken = await contractInterface.getNEBLToken();
            const balance = await neblToken.balanceOf(account);
            setNeblBalance(ethers.utils.formatEther(balance));

            // Only attempt to add to MetaMask if we haven't already (using localStorage to track)
            if (window.ethereum && balance.gt(0) && !localStorage.getItem('nebl-added-to-metamask')) {
                try {
                    const address = await neblToken.address;
                    const symbol = 'NEBL';
                    const decimals = 18;
                    
                    const success = await window.ethereum.request({
                        method: 'wallet_watchAsset',
                        params: [{
                            type: 'ERC20',
                            options: {
                                address: address,
                                symbol: symbol,
                                decimals: decimals,
                                image: 'https://raw.githubusercontent.com/your-repo/assets/main/nebl-logo.png'
                            }
                        }]
                    });

                    if (success) {
                        localStorage.setItem('nebl-added-to-metamask', 'true');
                    }
                } catch (error) {
                    console.error('Failed to add token to MetaMask:', error);
                }
            }
        } catch (err) {
            console.error('Failed to get NEBL balance:', err);
        }
    }, [contractInterface, account]);

    useEffect(() => {
        updateBalance();
        // Poll for balance updates every 5 seconds
        const interval = setInterval(updateBalance, 5000);
        return () => clearInterval(interval);
    }, [updateBalance]);

    useEffect(() => {
        const updateExpectedAmount = async () => {
            if (!contractInterface || !avaxAmount) {
                setExpectedNebl('0');
                return;
            }
            try {
                const neblSwap = await contractInterface.getNeblSwap();
                const neblAmount = await neblSwap.calculateNEBLAmount(ethers.utils.parseEther(avaxAmount));
                setExpectedNebl(ethers.utils.formatEther(neblAmount));
            } catch (err) {
                console.error('Failed to calculate NEBL amount:', err);
                setExpectedNebl('0');
            }
        };

        updateExpectedAmount();
    }, [avaxAmount, contractInterface]);

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account) return;

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const neblSwap = await contractInterface.getNeblSwap();
            const tx = await neblSwap.swapAVAXForNEBL({
                value: ethers.utils.parseEther(avaxAmount)
            });
            
            // Show pending status
            setLoading(true);
            
            const receipt = await tx.wait();
            
            // Listen for the SwapAVAXForNEBL event
            const event = receipt.events?.find((e: { event: string }) => e.event === 'SwapAVAXForNEBL');
            if (event) {
                const neblAmount = ethers.utils.formatEther(event.args.neblAmount);
                console.log(`Successfully swapped ${avaxAmount} AVAX for ${neblAmount} NEBL`);
            }

            setAvaxAmount('');
            setExpectedNebl('0');
            setSuccess(true);

            // Update balance multiple times to ensure it's captured after network delay
            await updateBalance();
            setTimeout(updateBalance, 2000);
            setTimeout(updateBalance, 5000);
        } catch (err: any) {
            console.error('Swap failed:', err);
            setError(err.message || 'Failed to swap tokens');
        } finally {
            setLoading(false);
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
        <div className="token-swap">
            <h1>Swap AVAX for NEBL</h1>
            
            <div className="balance-info">
                <p>Your NEBL Balance: {neblBalance} NEBL</p>
            </div>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">Swap completed successfully!</div>}
            
            <form onSubmit={handleSwap} className="swap-form">
                <div className="input-group">
                    <label>AVAX Amount</label>
                    <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={avaxAmount}
                        onChange={(e) => setAvaxAmount(e.target.value)}
                        placeholder="Enter AVAX amount"
                        required
                    />
                </div>
                
                <div className="expected-return">
                    Expected NEBL: {expectedNebl}
                </div>
                
                <button type="submit" disabled={loading || !avaxAmount}>
                    {loading ? 'Processing...' : 'Swap'}
                </button>
            </form>
        </div>
    );
};

export default TokenSwap;