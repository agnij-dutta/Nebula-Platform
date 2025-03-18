import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import WalletPrompt from './WalletPrompt';
import './CreateResearchProject.css';

interface Milestone {
    description: string;
    targetAmount: string;
    verificationCriteria: string;
}

const CreateResearchProject: React.FC = () => {
    const navigate = useNavigate();
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [deadline, setDeadline] = useState('');
    const [milestones, setMilestones] = useState<Milestone[]>([
        { description: '', targetAmount: '', verificationCriteria: '' }
    ]);
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleMilestoneChange = (index: number, field: keyof Milestone, value: string) => {
        const updatedMilestones = [...milestones];
        updatedMilestones[index] = {
            ...updatedMilestones[index],
            [field]: value
        };
        setMilestones(updatedMilestones);
    };

    const addMilestone = () => {
        setMilestones([
            ...milestones,
            { description: '', targetAmount: '', verificationCriteria: '' }
        ]);
    };

    const removeMilestone = (index: number) => {
        if (milestones.length > 1) {
            setMilestones(milestones.filter((_, i) => i !== index));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles([...files, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account) return;

        setIsLoading(true);
        setError('');

        try {
            // Upload project files to IPFS
            const fileUploads = await Promise.all(
                files.map(file => ipfsService.uploadFile(file))
            );

            // Create project metadata
            const metadata = {
                title,
                description,
                category,
                files: fileUploads,
                createdAt: new Date().toISOString(),
                creator: account
            };

            // Upload metadata to IPFS
            const metadataCID = await ipfsService.uploadJSON(metadata);

            // Upload verification criteria for each milestone
            const verificationCIDs = await Promise.all(
                milestones.map(m => ipfsService.uploadJSON({
                    criteria: m.verificationCriteria,
                    timestamp: new Date().toISOString()
                }))
            );

            // Create on-chain project
            const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
            const tx = await contractInterface.createResearchProject(
                title,
                description,
                category,
                metadataCID,
                milestones.map(m => m.description),
                milestones.map(m => m.targetAmount), // Contract will handle conversion
                verificationCIDs,
                deadlineTimestamp
            );

            await tx.wait();
            navigate('/research');

        } catch (err: any) {
            console.error('Failed to create project:', err);
            setError(err.message || 'Failed to create research project');
        } finally {
            setIsLoading(false);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt
                message="Connect your wallet to create a research project"
                onConnect={connectWallet}
            />
        );
    }

    return (
        <div className="create-project">
            <h1>Create Research Project</h1>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="title">Project Title</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="Enter project title"
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        placeholder="Describe your research project"
                        rows={4}
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        required
                        disabled={isLoading}
                    >
                        <option value="">Select a category</option>
                        <option value="biotech">Biotechnology</option>
                        <option value="ai">Artificial Intelligence</option>
                        <option value="cleantech">Clean Technology</option>
                        <option value="medicine">Medicine</option>
                        <option value="physics">Physics</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="deadline">Funding Deadline</label>
                    <input
                        id="deadline"
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        required
                        min={new Date().toISOString().split('.')[0]}
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="files">Project Files</label>
                    <input
                        id="files"
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt,.zip"
                        disabled={isLoading}
                    />
                    <small>Upload relevant project documentation (PDF, DOC, TXT, ZIP)</small>
                    
                    {files.length > 0 && (
                        <div className="file-list">
                            {files.map((file, index) => (
                                <div key={index} className="file-item">
                                    <span>{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        className="remove-file"
                                        disabled={isLoading}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="milestones-section">
                    <h2>Milestones</h2>
                    {milestones.map((milestone, index) => (
                        <div key={index} className="milestone-form">
                            <h3>Milestone {index + 1}</h3>
                            
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={milestone.description}
                                    onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                                    required
                                    placeholder="Describe the milestone"
                                    rows={2}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Target Amount (AVAX)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={milestone.targetAmount}
                                    onChange={(e) => handleMilestoneChange(index, 'targetAmount', e.target.value)}
                                    required
                                    placeholder="Enter funding target"
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Verification Criteria</label>
                                <textarea
                                    value={milestone.verificationCriteria}
                                    onChange={(e) => handleMilestoneChange(index, 'verificationCriteria', e.target.value)}
                                    required
                                    placeholder="Define how this milestone will be verified"
                                    rows={2}
                                    disabled={isLoading}
                                />
                            </div>

                            {milestones.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeMilestone(index)}
                                    className="remove-milestone"
                                    disabled={isLoading}
                                >
                                    Remove Milestone
                                </button>
                            )}
                        </div>
                    ))}
                    
                    <button
                        type="button"
                        onClick={addMilestone}
                        className="add-milestone"
                        disabled={isLoading}
                    >
                        Add Milestone
                    </button>
                </div>

                <button
                    type="submit"
                    className="submit-button"
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating Project...' : 'Create Project'}
                </button>
            </form>
        </div>
    );
};

export default CreateResearchProject;