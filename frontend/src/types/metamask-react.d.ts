declare module 'metamask-react' {
    export interface MetaMaskState {
        status: 'initializing' | 'unavailable' | 'notConnected' | 'connecting' | 'connected';
        account: string | null;
        chainId: string | null;
        ethereum: any;
    }

    export interface MetaMaskContextValue extends MetaMaskState {
        connect: () => Promise<string[]>;
        addChain: (parameters: any) => Promise<void>;
        switchChain: (chainId: string) => Promise<void>;
        disconnect: () => void;
    }

    export function useMetaMask(): MetaMaskContextValue;

    export interface MetaMaskProviderProps {
        children: React.ReactNode;
    }

    export function MetaMaskProvider(props: MetaMaskProviderProps): JSX.Element;
} 