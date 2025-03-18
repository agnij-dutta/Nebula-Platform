import { create } from 'ipfs-http-client';
import { Buffer } from 'buffer';

// Configure IPFS client to use Infura's IPFS gateway
const projectId = 'YOUR_INFURA_PROJECT_ID';
const projectSecret = 'YOUR_INFURA_PROJECT_SECRET';
const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const client = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
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