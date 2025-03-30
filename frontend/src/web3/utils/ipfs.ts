import { create } from 'ipfs-http-client';
import { Buffer } from 'buffer';
import { IPTokenMetadata } from '../../types/ipTokens';

const INFURA_PROJECT_ID = '549a3becfe064ab59d726f192917646e';
const INFURA_PROJECT_SECRET = '4zLJi4DX/Kl+Jl2zYo9MknqJjQijpjvppCnJg7z89oyvxhCOIY6fXw';
const INFURA_ENDPOINT = 'https://avalanche-fuji.infura.io/v3/549a3becfe064ab59d726f192917646e';

const auth = 'Basic ' + Buffer.from(`${INFURA_PROJECT_ID}:${INFURA_PROJECT_SECRET}`).toString('base64');

const client = create({
    url: INFURA_ENDPOINT,
    headers: {
        authorization: auth,
    },
});

const IPFS_GATEWAYS = [
    'https://gateway.ipfs.io',
    'https://cloudflare-ipfs.com',
    'https://ipfs.io'
];

export const ipfsService = {
    async uploadFile(file: File): Promise<string> {
        try {
            const fileBuffer = await file.arrayBuffer();
            const result = await client.add(Buffer.from(fileBuffer));
            return result.path;
        } catch (error) {
            console.error('Error uploading file to IPFS:', error);
            throw new Error('Failed to upload file to IPFS');
        }
    },

    async uploadJSON(data: any): Promise<string> {
        try {
            const jsonString = JSON.stringify(data);
            const result = await client.add(jsonString);
            return result.path;
        } catch (error) {
            console.error('Error uploading JSON to IPFS:', error);
            throw new Error('Failed to upload JSON to IPFS');
        }
    },

    async uploadIPMetadata(metadata: IPTokenMetadata): Promise<string> {
        return this.uploadJSON(metadata);
    },

    async getIPMetadata(cid: string): Promise<IPTokenMetadata> {
        const data = await this.fetchIPFSContent(cid);
        return data as IPTokenMetadata;
    },

    getIPFSUrl(cid: string): string {
        // Try multiple gateways to avoid CORS issues
        const gateway = IPFS_GATEWAYS[Math.floor(Math.random() * IPFS_GATEWAYS.length)];
        return `${gateway}/ipfs/${cid}`;
    },

    async fetchIPFSContent(cid: string): Promise<any> {
        let lastError: Error | null = null;
        
        // Try each gateway until one works
        for (const gateway of IPFS_GATEWAYS) {
            try {
                const response = await fetch(`${gateway}/ipfs/${cid}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (err) {
                lastError = err as Error;
                continue;
            }
        }
        
        throw lastError || new Error('Failed to fetch IPFS content');
    }
};

export default ipfsService;