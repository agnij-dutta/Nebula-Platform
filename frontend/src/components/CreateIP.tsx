import React, { useState, useCallback } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import { IPTokenMetadata } from '../types/ipTokens';
import WalletPrompt from './WalletPrompt';
import './CreateIP.css';

interface CreateIPProps {
    onIPCreated: (tokenId: string) => void;
}

const CreateIP: React.FC<CreateIPProps> = ({ onIPCreated }) => {
    const { contractInterface, needsWallet, connectWallet, isConnecting } = useWeb3();
    
    // Basic on-chain data
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [licenseTerms, setLicenseTerms] = useState('');
    
    // Optional IPFS metadata
    const [images, setImages] = useState<File[]>([]);
    const [documents, setDocuments] = useState<File[]>([]);
    const [category, setCategory] = useState('');
    const [tags, setTags] = useState('');
    const [version, setVersion] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadingToIPFS, setUploadingToIPFS] = useState(false);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'images' | 'documents') => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (type === 'images') {
                setImages(prev => [...prev, ...files]);
            } else {
                setDocuments(prev => [...prev, ...files]);
            }
        }
    }, []);

    const uploadToIPFS = async (): Promise<string | null> => {
        try {
            setUploadingToIPFS(true);
            
            // Upload files first if any
            const uploadedImages = await Promise.all(
                images.map(file => ipfsService.uploadFile(file))
            );
            
            const uploadedDocs = await Promise.all(
                documents.map(file => ipfsService.uploadFile(file))
            );

            // Create and upload metadata
            const metadata: IPTokenMetadata = {
                title,
                description,
                images: uploadedImages,
                documents: uploadedDocs,
                additionalDetails: {
                    category: category || undefined,
                    tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
                    version: version || undefined,
                    createdAt: new Date().toISOString()
                }
            };

            return await ipfsService.uploadIPMetadata(metadata);
        } catch (err) {
            console.warn('Failed to upload to IPFS:', err);
            return null;
        } finally {
            setUploadingToIPFS(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface) return;
        
        setIsLoading(true);
        setError('');

        try {
            // Try to upload to IPFS first if there are any files or additional metadata
            let ipfsUri = '';
            if (images.length > 0 || documents.length > 0 || category || tags || version) {
                ipfsUri = await uploadToIPFS() || '';
            }

            // Create IP token with on-chain data and optional IPFS URI
            const tokenId = await contractInterface.createIP(
                title,
                description,
                ipfsUri, // Will be empty string if IPFS upload failed or wasn't needed
                licenseTerms
            );
            
            // Clear form
            setTitle('');
            setDescription('');
            setLicenseTerms('');
            setImages([]);
            setDocuments([]);
            setCategory('');
            setTags('');
            setVersion('');
            
            // Notify parent
            onIPCreated(tokenId);
        } catch (err: any) {
            let errorMessage = 'Could not create IP token';
            
            if (err.code === 'INSUFFICIENT_FUNDS') {
                errorMessage = 'You need AVAX in your wallet to create an IP token';
            } else if (err.code === 'USER_REJECTED') {
                errorMessage = 'You declined the transaction. Try again when ready';
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to create and tokenize your IP"
                onConnect={connectWallet}
                isLoading={isConnecting}
            />
        );
    }

    return (
        <div className="create-ip">
            <h2>Create New IP Token</h2>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="title">Title *</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description *</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="licenseTerms">License Terms *</label>
                    <textarea
                        id="licenseTerms"
                        value={licenseTerms}
                        onChange={(e) => setLicenseTerms(e.target.value)}
                        required
                        disabled={isLoading}
                        placeholder="Enter the terms under which this IP can be licensed..."
                    />
                </div>

                <div className="optional-section">
                    <h3>Additional Details (Optional)</h3>
                    
                    <div className="form-group">
                        <label htmlFor="category">Category</label>
                        <input
                            id="category"
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="tags">Tags (comma-separated)</label>
                        <input
                            id="tags"
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            disabled={isLoading}
                            placeholder="e.g., research, blockchain, technology"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="version">Version</label>
                        <input
                            id="version"
                            type="text"
                            value={version}
                            onChange={(e) => setVersion(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Images</label>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileChange(e, 'images')}
                            disabled={isLoading}
                        />
                        {images.length > 0 && (
                            <div className="file-list">
                                {images.map((file, index) => (
                                    <div key={index} className="file-item">
                                        {file.name}
                                        <button
                                            type="button"
                                            onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                                            disabled={isLoading}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Documents</label>
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            multiple
                            onChange={(e) => handleFileChange(e, 'documents')}
                            disabled={isLoading}
                        />
                        {documents.length > 0 && (
                            <div className="file-list">
                                {documents.map((file, index) => (
                                    <div key={index} className="file-item">
                                        {file.name}
                                        <button
                                            type="button"
                                            onClick={() => setDocuments(prev => prev.filter((_, i) => i !== index))}
                                            disabled={isLoading}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button type="submit" disabled={isLoading || uploadingToIPFS}>
                    {isLoading ? 'Creating...' :
                     uploadingToIPFS ? 'Uploading to IPFS...' :
                     'Create IP Token'}
                </button>
            </form>
        </div>
    );
};

export default CreateIP;