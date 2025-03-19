import { create } from 'ipfs-http-client';
import { Buffer } from 'buffer';

// Configure IPFS client using environment variables
const projectId = process.env.REACT_APP_IPFS_PROJECT_ID;
const projectSecret = process.env.REACT_APP_IPFS_PROJECT_SECRET;

if (!projectId || !projectSecret) {
    console.error('IPFS credentials not found in environment variables');
}

const auth = 'Basic ' + Buffer.from(`${projectId}:${projectSecret}`).toString('base64');

const client = create({
    host: process.env.REACT_APP_IPFS_HOST || 'ipfs.infura.io',
    port: parseInt(process.env.REACT_APP_IPFS_PORT || '5001'),
    protocol: process.env.REACT_APP_IPFS_PROTOCOL || 'https',
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
        return `${process.env.REACT_APP_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'}${cid}`;
    }
};

export default ipfsService;