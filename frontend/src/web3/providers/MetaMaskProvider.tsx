import React, { ReactNode } from 'react';
import { MetaMaskProvider as MetaMaskReactProvider } from 'metamask-react';

interface MetaMaskProviderProps {
    children: ReactNode;
}

export const MetaMaskProvider: React.FC<MetaMaskProviderProps> = ({ children }) => {
    return (
        <MetaMaskReactProvider>
            {children}
        </MetaMaskReactProvider>
    );
}; 