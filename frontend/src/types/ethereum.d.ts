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

interface Ethereum {
    isMetaMask?: boolean;
    request: (args: RequestArguments) => Promise<any>;
    on: <K extends EthereumEventKeys>(event: K, handler: EthereumEventHandler<K>) => void;
    removeListener: <K extends EthereumEventKeys>(event: K, handler: EthereumEventHandler<K>) => void;
    addListener: <K extends EthereumEventKeys>(event: K, handler: EthereumEventHandler<K>) => void;
    removeAllListeners: (event: EthereumEventKeys) => void;
    autoRefreshOnNetworkChange?: boolean;
    chainId?: string;
    networkVersion?: string;
    selectedAddress?: string | null;
    isConnected: () => boolean;
}

declare global {
    interface Window {
        ethereum?: Ethereum;
    }
}

export {};