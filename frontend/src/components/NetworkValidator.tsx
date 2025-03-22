import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { WEB3_CONFIG } from '../web3/config';
import './NetworkSwitchOverlay.css';

const NetworkValidator: React.FC = () => {
    const { provider, chainId, error, switchToFujiTestnet } = useWeb3();
    const [isValidating, setIsValidating] = useState(false);
    const [validationAttempts, setValidationAttempts] = useState(0);
    const MAX_AUTO_SWITCH_ATTEMPTS = 3;

    useEffect(() => {
        const validateNetwork = async () => {
            if (!provider || isValidating) return;
            
            try {
                setIsValidating(true);
                const network = await provider.getNetwork();
                const currentDomain = window.location.hostname;
                
                // Check if current domain is allowed
                const isAllowedDomain = WEB3_CONFIG.CONNECTION_CONFIG.allowedDomains.some(domain => 
                    currentDomain === domain || currentDomain.endsWith(`.${domain}`)
                );

                if (!isAllowedDomain) {
                    console.warn('Domain not in allowlist:', currentDomain);
                }

                // Auto switch network if needed and under max attempts
                if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId && 
                    validationAttempts < MAX_AUTO_SWITCH_ATTEMPTS) {
                    try {
                        await switchToFujiTestnet();
                        setValidationAttempts(prev => prev + 1);
                    } catch (err) {
                        console.error('Auto network switch failed:', err);
                    }
                }
            } catch (err) {
                console.error('Network validation failed:', err);
            } finally {
                setIsValidating(false);
            }
        };

        validateNetwork();
    }, [provider, chainId, switchToFujiTestnet, isValidating, validationAttempts]);

    // Reset validation attempts when network is correct
    useEffect(() => {
        if (chainId === WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
            setValidationAttempts(0);
        }
    }, [chainId]);

    if (error) {
        return (
            <div className="network-error-banner">
                {error}
                {validationAttempts >= MAX_AUTO_SWITCH_ATTEMPTS && (
                    <div className="manual-switch-prompt">
                        Please switch to {WEB3_CONFIG.NETWORKS.TESTNET.name} manually in your wallet
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default NetworkValidator;