import { ExternalProvider } from '@ethersproject/providers';

export interface EthereumProvider extends ExternalProvider {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (eventName: string, handler: (...args: any[]) => void) => void;
    removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
}

interface RequestArguments {
    method: string;
    params?: any[];
}

interface ProviderRpcError extends Error {
    message: string;
    code: number;
    data?: unknown;
}

interface EthereumEvent {
    connect: { chainId: string };
    disconnect: Error;
    accountsChanged: string[];
    chainChanged: string;
    message: { type: string; data: unknown };
}

type EthereumEventKeys = keyof EthereumEvent;
type EthereumEventHandler<K extends EthereumEventKeys> = (event: EthereumEvent[K]) => void;

declare global {
    interface Window {
        ethereum?: EthereumProvider;
    }
}

export {};