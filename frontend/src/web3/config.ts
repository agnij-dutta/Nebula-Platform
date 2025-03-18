// Web3 configuration and contract addresses
export const WEB3_CONFIG = {
    NETWORKS: {
        MAINNET: {
            chainId: 43114,
            name: 'Avalanche Mainnet',
            rpcUrl: process.env.REACT_APP_AVALANCHE_MAINNET_RPC || 'https://api.avax.network/ext/bc/C/rpc',
            nativeCurrency: {
                name: 'AVAX',
                symbol: 'AVAX',
                decimals: 18
            },
            blockExplorerUrl: 'https://snowtrace.io'
        },
        TESTNET: {
            chainId: 43113,
            name: 'Avalanche Fuji Testnet',
            rpcUrl: process.env.REACT_APP_AVALANCHE_TESTNET_RPC || 'https://api.avax-test.network/ext/bc/C/rpc',
            blockExplorerUrl: 'https://testnet.snowtrace.io',
            nativeCurrency: {
                name: 'AVAX',
                symbol: 'AVAX',
                decimals: 18
            },
            chainName: 'Avalanche FUJI C-Chain'
        }
    },
    CONNECTION_CONFIG: {
        timeoutMs: 10000, // 10 seconds timeout
        retryCount: 2,
        retryDelayMs: 1000,
        autoConnect: false // Disable auto wallet connection
    },
    CONTRACTS: {
        IPMarketplace: {
            address: '0x554157ab69F167A2946FFd74d5263c216A723dc1',
        },
        IPToken: {
            address: '0x334B4e1C27059A3A50E6abEebf428536411fE11e',
        },
        NEBLToken: {
            address: '0x6bE799db96487ba39262e15e6D8b1b67aC8b4DA0',
        },
        NEBLSwap: {
            address: '0x512ade688582F8181047B202EdFacd9043632A03',
        },
        ResearchProject: {
            address: '0xaaA182881458e309F9e93565f152907e50CF1141',
        },
        Governance: {
            address: '0x9b9d8D08b75503cCD83d005092c1bfB7e1A0F371',
        },
        Disputes: {
            address: '0xCDa9e66F962EAAc98ebcFA925939A50263a07039',
        },
        MilestoneOracle: {
            address: '0xe87758C6CCcf3806C9f1f0C8F99f6Dcae36E5449',
        },
        FundingEscrow: {
            address: '0x4a4366d37B81a6197ef42a76E05C5b66F145154D',
        }
    },
    GAS_LIMIT_MULTIPLIER: 1.2, // Add 20% to estimated gas
    ETHERS_CONFIG: {
        blockConfirmations: 2,
        timeout: 30000, // 30 seconds transaction timeout
        rpcConfig: {
            allowRetry: true,
            maxRetries: 3,
            retryInterval: 1000,
            batchSize: 10000, // Maximum blocks to query at once
            customBackoff: (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000)
        }
    }
}