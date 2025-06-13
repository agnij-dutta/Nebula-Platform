import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import WalletPrompt from './WalletPrompt';
import './CreateResearchProject.css';

interface Milestone {
    description: string;
    targetAmount: string;
    verificationCriteria: string;
}

const CreateResearchProject: React.FC = () => {
    const navigate = useNavigate();
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3Context();
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

    const checkTitleUniqueness = async (title: string): Promise<boolean> => {
        if (!contractInterface) return true;
        const maxPossibleProjects = 100;
        
        for (let projectId = 1; projectId <= maxPossibleProjects; projectId++) {
            try {
                const project = await contractInterface.getProjectDetails(projectId.toString());
                if (project && project.title.toLowerCase() === title.toLowerCase()) {
                    return false;
                }
            } catch (err: any) {
                if (err?.message?.includes('Project not found')) {
                    break;
                }
                continue;
            }
        }
        return true;
    };

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
            // Check if title is unique
            const isTitleUnique = await checkTitleUniqueness(title);
            if (!isTitleUnique) {
                throw new Error('A project with this title already exists. Please choose a different title.');
            }

            // Validate deadline
            const deadlineDate = new Date(deadline);
            const currentDate = new Date();
            
            if (deadlineDate <= currentDate) {
                throw new Error('Deadline must be in the future');
            }

            // Add 1 day buffer to ensure blockchain timestamp validation passes
            const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000);
            if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
                throw new Error('Invalid deadline timestamp');
            }

            // Create on-chain project directly without IPFS
            const tx = await contractInterface.createResearchProject(
                title,
                description,
                category,
                "", // Empty metadataURI since we're not using IPFS yet
                milestones.map(m => m.description),
                milestones.map(m => m.targetAmount),
                milestones.map(m => m.verificationCriteria),
                deadlineTimestamp
            );

            // Wait for the transaction to be mined and get the receipt
            const receipt = await tx.wait();
            const event = receipt.events?.find((e: { event: string }) => e.event === 'ProjectCreated');
            if (!event) {
                throw new Error('Failed to get project creation event');
            }

            // Small delay to allow blockchain state to update
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Navigate back to research hub
            navigate('/research', { replace: true });
            
            // Force a page refresh to update the projects list
            window.location.reload();

        } catch (err: any) {
            console.error('Failed to create project:', err);
            setError(err.message || 'Failed to create research project');
        } finally {
            setIsLoading(false);
        }
    };

    const getCurrentDateTimeLocal = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
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
                        min={getCurrentDateTimeLocal()}
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