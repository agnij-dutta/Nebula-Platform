import { createConfig, configureChains } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WEB3_CONFIG } from './config';

// Configure chains
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [avalancheFuji, avalanche],
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === avalancheFuji.id) {
          return {
            http: WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0],
            webSocket: WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0].replace('http', 'ws'),
          };
        }
        if (chain.id === avalanche.id) {
          return {
            http: WEB3_CONFIG.NETWORKS.MAINNET.rpcUrl[0],
            webSocket: WEB3_CONFIG.NETWORKS.MAINNET.rpcUrl[0].replace('http', 'ws'),
          };
        }
        return null;
      },
    }),
    publicProvider(),
  ]
);

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
  // WalletConnect disabled temporarily due to invalid project ID
  // new WalletConnectConnector({
  //   chains,
  //   options: {
  //     projectId: 'nebula-platform', // Replace with your WalletConnect project ID
  //     showQrModal: true,
  //   },
  // }),
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
