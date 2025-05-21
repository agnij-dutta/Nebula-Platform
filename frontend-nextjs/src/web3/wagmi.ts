import { createConfig, configureChains } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WEB3_CONFIG } from './config';

// Configure chains with custom RPC URLs from config
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [avalanche, avalancheFuji],
  [
    // Add custom RPC providers
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === avalanche.id) {
          return {
            http: WEB3_CONFIG.NETWORKS.MAINNET.rpcUrl[0],
          };
        }
        if (chain.id === avalancheFuji.id) {
          return {
            http: WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0],
          };
        }
        return null;
      },
    }),
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID || '' }),
    publicProvider(),
  ]
);

// Get WalletConnect project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Configure connectors
const connectors = [
  new MetaMaskConnector({ chains }),
  new CoinbaseWalletConnector({
    chains,
    options: {
      appName: 'Nebula Platform',
      jsonRpcUrl: WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0],
    },
  }),
  new WalletConnectConnector({
    chains,
    options: {
      projectId: walletConnectProjectId,
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
      },
    },
  }),
  new InjectedConnector({
    chains,
    options: {
      name: 'Injected Wallet',
      shimDisconnect: true,
    },
  }),
];

// Create client
export const config = createConfig({
  autoConnect: false,
  connectors,
  publicClient,
  webSocketPublicClient,
});

export { chains }; 