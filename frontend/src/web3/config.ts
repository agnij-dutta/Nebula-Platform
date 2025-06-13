// Web3 configuration and contract addresses
export const WEB3_CONFIG = {
    NETWORKS: {
        MAINNET: {
            chainId: 43114,
            name: 'Avalanche Mainnet',
            rpcUrl: [
                process.env.REACT_APP_AVALANCHE_MAINNET_RPC || 'https://api.avax.network/ext/bc/C/rpc',
                'https://avalanche-c-chain.publicnode.com',
                'https://avalanche.public-rpc.com'
            ],
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
            rpcUrl: [
                'https://api.avax-test.network/ext/bc/C/rpc',
                'https://avalanche-fuji-c-chain.publicnode.com',
                'https://avalanche-fuji.blockpi.network/v1/rpc/public'
            ],
            blockExplorerUrl: 'https://testnet.snowtrace.io',
            nativeCurrency: {
                name: 'AVAX',
                symbol: 'AVAX',
                decimals: 18
            },
            chainName: 'Avalanche Fuji Testnet'
        }
    },
    CONNECTION_CONFIG: {
        timeoutMs: 15000, // Reduced timeout for faster fallback
        retryCount: 5, // Increased retry count
        retryDelayMs: 1000,
        autoConnect: true,
        allowedDomains: ['localhost', 'nebula-platform-one.vercel.app']
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
            address: '0xf7CD5eea2c270D0f13092CEf22f6DBec82Cd11bb',
        },
        ResearchProject: {
            address: '0xE5fa781CA7A6d94dcB571f191c92E5BC8f9f4B41',
        },
        Governance: {
            address: '0x9b9d8D08b75503cCD83d005092c1bfB7e1A0F371',
        },
        Disputes: {
            address: '0xCDa9e66F962EAAc98ebcFA925939A50263a07039',
        },
        MilestoneOracle: {
            address: '0x7dA51954733b2F928A4f279B41B6e5e4490c7D0E',
        },
        MilestoneVerification: {
            address: '0x7dA51954733b2F928A4f279B41B6e5e4490c7D0E',
        },
        FundingEscrow: {
            address: '0xE328421898E13c9B5401Ec257A5D812C147d7D24',
        },
        // New modular contracts
        Registry: {
            address: '0xcC9Ddd2f94aA0C619Cb2c6F8b7e5ED1F5aB5604D',
        },
        IPAsset: {
            address: '0x1762ac35d8d1ff8Bc5CA544DD6656cbF8f8f0F6E',
        },
        LicenseModule: {
            address: '0x87819a4e75776daAc7D72626453D89F0bCD8F1f9',
        },
        RoyaltyModule: {
            address: '0xD3fF01EFFb7BFb763Fe24E697a23109b00b194f0',
        }
    },
    GAS_LIMIT_MULTIPLIER: 1.2,
    ETHERS_CONFIG: {
        blockConfirmations: 2,
        timeout: 30000,
        rpcConfig: {
            allowRetry: true,
            maxRetries: 3,
            retryInterval: 1000,
            batchSize: 1000, // Reduced batch size
            customBackoff: (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000),
            maxConcurrentBatches: 1, // Reduced to prevent rate limiting
            batchTimeout: 30000,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST',
                'Content-Type': 'application/json'
            }
        }
    }
};

