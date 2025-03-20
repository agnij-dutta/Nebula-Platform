import { create } from 'ipfs-http-client';
import { Buffer } from 'buffer';

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

    getIPFSUrl(cid: string): string {
        return `https://ipfs.io/ipfs/${cid}`;
    }
};

export default ipfsService;