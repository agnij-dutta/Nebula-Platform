import axios from 'axios';

// Configure IPFS service
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '';

// Type definitions
interface IPFSUploadResponse {
  success: boolean;
  ipfsHash?: string;
  pinataUrl?: string;
  error?: string;
}

interface IPFSMetadata {
  title?: string;
  description?: string;
  image?: string;
  licenseTerms?: string;
  category?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// IPFS gateway URLs
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.infura.io/ipfs/',
];

class IPFSService {
  private gatewayIndex = 0;

  async uploadFile(file: File): Promise<IPFSUploadResponse> {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn('Pinata API keys not set, cannot upload to IPFS');
      return {
        success: false,
        error: 'Pinata API keys not configured'
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(PINATA_API_URL, formData, {
        maxBodyLength: Infinity, // Allow large files
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      });

      if (response.status === 200) {
        const ipfsHash = response.data.IpfsHash;
        return {
          success: true,
          ipfsHash,
          pinataUrl: `${IPFS_GATEWAY}${ipfsHash}`
        };
      } else {
        return {
          success: false,
          error: `Upload failed with status: ${response.status}`
        };
      }
    } catch (error: any) {
      console.error('Error uploading to IPFS:', error);
      return {
        success: false,
        error: error.message || 'Unknown error uploading to IPFS'
      };
    }
  }

  async uploadJSON(data: any): Promise<IPFSUploadResponse> {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn('Pinata API keys not set, cannot upload to IPFS');
      return {
        success: false,
        error: 'Pinata API keys not configured'
      };
    }

    try {
      // Convert JSON to Blob/File
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const file = new File([blob], 'metadata.json', { type: 'application/json' });
      
      return await this.uploadFile(file);
    } catch (error: any) {
      console.error('Error uploading JSON to IPFS:', error);
      return {
        success: false,
        error: error.message || 'Unknown error uploading JSON to IPFS'
      };
    }
  }

  async getContentFromURI(uri: string): Promise<IPFSMetadata | null> {
    try {
      // Handle ipfs:// protocol
      if (uri.startsWith('ipfs://')) {
        uri = uri.replace('ipfs://', IPFS_GATEWAY);
      }
      
      // Use direct HTTP request for IPFS gateway
      const response = await axios.get(uri, {
        timeout: 15000 // 15 seconds timeout
      });
      
      if (response.status === 200 && response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching content from IPFS:', error);
      return null;
    }
  }

  // Convert IPFS hash to URL
  public getIPFSUrl(cid: string): string {
    if (!cid) return '';
    
    // If it's already a URL, return it
    if (cid.startsWith('http')) {
      return cid;
    }
    
    // If it's an IPFS URI, extract the CID
    if (cid.startsWith('ipfs://')) {
      cid = cid.replace('ipfs://', '');
    }
    
    // Use the current gateway
    return `${IPFS_GATEWAYS[this.gatewayIndex]}${cid}`;
  }
  
  // Rotate to next gateway (useful for fallbacks)
  public rotateGateway(): string {
    this.gatewayIndex = (this.gatewayIndex + 1) % IPFS_GATEWAYS.length;
    return IPFS_GATEWAYS[this.gatewayIndex];
  }
  
  // Fetch metadata from IPFS
  public async fetchIPFSMetadata<T = any>(cid: string): Promise<T | null> {
    if (!cid) return null;
    
    const url = this.getIPFSUrl(cid);
    let attempts = 0;
    
    while (attempts < IPFS_GATEWAYS.length) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return await response.json();
      } catch (err) {
        console.warn(`IPFS fetch failed for ${url}:`, err);
        this.rotateGateway();
        attempts++;
      }
    }
    
    console.error(`Failed to fetch IPFS metadata after ${attempts} attempts`);
    return null;
  }
}

export const ipfsService = new IPFSService(); 