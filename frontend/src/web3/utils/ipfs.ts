import { create } from 'ipfs-http-client';

const IPFS_NODE = 'https://ipfs.infura.io:5001/api/v0';

class IPFSService {
    private ipfs;

    constructor() {
        this.ipfs = create({ url: IPFS_NODE });
    }

    async uploadFile(file: File): Promise<string> {
        try {
            const added = await this.ipfs.add(file);
            return added.path;
        } catch (error) {
            console.error('IPFS upload failed:', error);
            throw new Error('Failed to upload file to IPFS');
        }
    }

    async uploadJSON(data: any): Promise<string> {
        try {
            const jsonString = JSON.stringify(data);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const added = await this.ipfs.add(blob);
            return added.path;
        } catch (error) {
            console.error('IPFS JSON upload failed:', error);
            throw new Error('Failed to upload JSON to IPFS');
        }
    }

    async fetchJSON(cid: string): Promise<any> {
        try {
            const response = await fetch(`${this.getIPFSUrl(cid)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch from IPFS');
            }
            return response.json();
        } catch (error) {
            console.error('IPFS JSON fetch failed:', error);
            throw new Error('Failed to fetch JSON from IPFS');
        }
    }

    getIPFSUrl(cid: string): string {
        return `https://ipfs.io/ipfs/${cid}`;
    }
}

export const ipfsService = new IPFSService();
export default ipfsService;