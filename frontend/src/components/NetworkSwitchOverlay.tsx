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
                <div className="network-status">
                    <div className={`network-indicator ${chainId ? 'wrong-network' : ''}`} />
                    <span>Wrong Network</span>
                </div>
                
                <div className="network-info">
                    {chainId && (
                        <div className="current-network">
                            <div className="network-indicator wrong-network" />
                            <span>Current: Unknown Network ({chainId})</span>
                        </div>
                    )}
                    <div className="required-network">
                        <div className="network-indicator" />
                        <span>Required: {WEB3_CONFIG.NETWORKS.TESTNET.name}</span>
                    </div>
                </div>

                <button 
                    onClick={handleNetworkSwitch}
                    disabled={isNetworkSwitching}
                    className={`switch-button ${isNetworkSwitching ? 'loading' : ''}`}
                >
                    {isNetworkSwitching ? 'Switching Network...' : 'Switch Network'}
                </button>

                <p className="network-message">
                    Please switch your network to {WEB3_CONFIG.NETWORKS.TESTNET.name} to use the application.
                </p>
            </div>
        </div>
    );
};
