import React, { useCallback } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import './NetworkSwitchOverlay.css';
import { WEB3_CONFIG } from '../web3/config';

export const NetworkSwitchOverlay: React.FC = () => {
    const { chainId, error, isNetworkSwitching, switchToFujiTestnet } = useWeb3();

    const handleNetworkSwitch = useCallback(async () => {
        try {
            await switchToFujiTestnet();
        } catch (err) {
            console.error('Failed to switch network:', err);
        }
    }, [switchToFujiTestnet]);

    if (!error || chainId === WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
        return null;
    }

    return (
        <div className="network-switch-overlay">
            <div className="network-switch-content">
                <div className="network-header">
                    <h2>Wrong Network</h2>
                    <p>It seems that you are connecting to an unsupported network. Please change network on your wallet to Avalanche Fuji Testnet</p>
                </div>
                
                <div className="network-loading-indicator">
                    <div className="circle-loader"></div>
                </div>
                
                <div className="network-info">
                    <div className="network-comparison">
                        <div className="current-network">
                            <div className="network-indicator wrong-network"></div>
                            <div className="network-details">
                                <span className="network-label">Current</span>
                                <span className="network-name">{chainId ? `Unknown Network (${chainId})` : 'Not Connected'}</span>
                            </div>
                        </div>
                        
                        <div className="divider">
                            <span className="divider-icon">→</span>
                        </div>
                        
                        <div className="required-network">
                            <div className="network-indicator correct-network"></div>
                            <div className="network-details">
                                <span className="network-label">Required</span>
                                <span className="network-name">{WEB3_CONFIG.NETWORKS.TESTNET.name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleNetworkSwitch}
                    disabled={isNetworkSwitching}
                    className={`switch-button ${isNetworkSwitching ? 'loading' : ''}`}
                >
                    {isNetworkSwitching ? 'Switching...' : 'Switch Network'}
                </button>

                <div className="manual-instructions">
                    <p>If the automatic switch doesn't work, please manually change your network in MetaMask to {WEB3_CONFIG.NETWORKS.TESTNET.name}.</p>
                </div>
            </div>
        </div>
    );
};
