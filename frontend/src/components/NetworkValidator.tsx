import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { WEB3_CONFIG } from '../web3/config';

const NetworkValidator: React.FC = () => {
    const { provider, chainId, error, switchToFujiTestnet } = useWeb3();
    const [isValidating, setIsValidating] = useState(false);

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

                // Auto switch network if needed
                if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                    await switchToFujiTestnet();
                }
            } catch (err) {
                console.error('Network validation failed:', err);
            } finally {
                setIsValidating(false);
            }
        };

        validateNetwork();
    }, [provider, chainId, switchToFujiTestnet, isValidating]);

    if (error) {
        return (
            <div className="network-error-banner">
                {error}
            </div>
        );
    }

    return null;
};

export default NetworkValidator;