import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers, BigNumber } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import { Project, Milestone } from '../types/contracts';
import MilestoneVerificationStatus from './MilestoneVerificationStatus';
import WalletPrompt from './WalletPrompt';
import './ProjectDetails.css';

interface ProjectMetadata {
    title: string;
    description: string;
    category: string;
    files: string[];
    createdAt: string;
    creator: string;
}

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [project, setProject] = useState<Project | null>(null);
    const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [selectedMilestone, setSelectedMilestone] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [txPending, setTxPending] = useState(false);

    const loadProject = useCallback(async () => {
        if (!contractInterface || !id) return;

        setLoading(true);
        setError('');

        try {
            const projectData = await contractInterface.getProjectDetails(id);

            const transformedProject: Project = {
                projectId: id,
                title: projectData.title,
                description: projectData.description,
                researcher: projectData.researcher,
                totalFunding: ethers.utils.parseUnits(projectData.totalFunding.split('.')[0], 'ether'),
                currentFunding: ethers.utils.parseUnits(projectData.currentFunding.split('.')[0], 'ether'),
                isActive: projectData.isActive,
                category: projectData.category,
                createdAt: BigNumber.from(projectData.createdAt || '0'),
                metadataURI: projectData.metadataURI,
                isCancelled: Boolean(projectData.isActive === false),
                deadline: BigNumber.from(projectData.deadline || '0'),
                milestones: projectData.milestones.map((m: any) => ({
                    description: m.description,
                    targetAmount: ethers.utils.parseUnits(m.targetAmount.split('.')[0], 'ether'),
                    currentAmount: ethers.utils.parseUnits(m.currentAmount.split('.')[0], 'ether'),
                    isCompleted: m.isCompleted,
                    fundsReleased: Boolean(m.fundsReleased),
                    verificationCriteria: m.verificationCriteria || ''
                }))
            };

            setProject(transformedProject);

            // Load metadata from IPFS with fallback to on-chain data
            if (projectData.metadataURI) {
                try {
                    const metadata = await ipfsService.fetchIPFSContent(projectData.metadataURI);
                    setMetadata(metadata);
                } catch (err) {
                    console.warn('Failed to load IPFS metadata, using fallback:', err);
                    setMetadata({
                        title: projectData.title,
                        description: projectData.description,
                        category: projectData.category,
                        files: [],
                        createdAt: new Date(projectData.createdAt * 1000).toISOString(),
                        creator: projectData.researcher
                    });
                }
            } else {
                // Use on-chain data if no metadataURI is provided
                setMetadata({
                    title: projectData.title,
                    description: projectData.description,
                    category: projectData.category,
                    files: [],
                    createdAt: new Date(projectData.createdAt * 1000).toISOString(),
                    creator: projectData.researcher
                });
            }
        } catch (err: any) {
            console.error('Failed to load project:', err);

            // Handle different error types with more specific messages
            let errorMessage = 'Failed to load project details. Please try again.';

            if (err.message?.includes('Project not found') ||
                err.message?.includes('invalid project id') ||
                err.message?.includes('nonexistent token')) {
                errorMessage = `Project with ID ${id} not found. It may not exist or has been removed.`;
                console.error(errorMessage);
            } else if (err.message?.includes('network') ||
                       err.message?.includes('connection') ||
                       err.code === -32603) {
                errorMessage = 'Network connection error. Please check your connection and try again.';
            }

            setError(errorMessage);
            setProject(null);
            setMetadata(null);
        } finally {
            setLoading(false);
        }
    }, [contractInterface, id]);

    useEffect(() => {
        loadProject();
    }, [loadProject]);

    const handleFund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account || !id || !project) return;

        setTxPending(true);
        setError('');

        try {
            // Convert amount to wei
            const amountInWei = ethers.utils.parseEther(fundAmount);

            // Validate amount against milestone target
            const milestone = project.milestones[selectedMilestone];
            const remainingAmount = milestone.targetAmount.sub(milestone.currentAmount);
            if (amountInWei.gt(remainingAmount)) {
                throw new Error('Amount exceeds milestone target');
            }

            // Check if user has enough balance including gas
            const provider = contractInterface.provider;
            const balance = await provider.getBalance(account);

            // Get the research project contract to estimate gas
            const researchProject = await contractInterface.getResearchProject();

            // Estimate gas for the transaction
            const gasEstimate = await researchProject.estimateGas.fundProject(
                id,
                (selectedMilestone + 1).toString(),
                { value: amountInWei, from: account }
            );

            // Add 20% buffer to gas estimate
            const gasBuffer = gasEstimate.mul(120).div(100);
            const estimatedGasCost = gasBuffer.mul(await provider.getGasPrice());

            // Total required = amount + gas cost
            const totalRequired = amountInWei.add(estimatedGasCost);

            console.log('User Balance:', ethers.utils.formatEther(balance));
            console.log('Funding Amount:', ethers.utils.formatEther(amountInWei));
            console.log('Estimated Gas Cost:', ethers.utils.formatEther(estimatedGasCost));
            console.log('Total Required:', ethers.utils.formatEther(totalRequired));

            if (balance.lt(totalRequired)) {
                throw new Error(`Insufficient balance (${ethers.utils.formatEther(balance)} AVAX) to fund project and cover gas costs (${ethers.utils.formatEther(totalRequired)} AVAX required)`);
            }

            // Use fundAmount directly as a string - it will be converted to Wei in the contract interface
            const tx = await contractInterface.fundProjectMilestone(
                id,
                (selectedMilestone + 1).toString(), // Milestones are 1-indexed in contract
                fundAmount // Pass the amount as a string in AVAX
            );
            await tx.wait();

            await loadProject();
            setFundAmount('');
        } catch (err: any) {
            console.error('Failed to fund project:', err);
            setError(err.message || 'Failed to fund project');
        } finally {
            setTxPending(false);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt
                message="Connect your wallet to view and fund this research project"
                onConnect={connectWallet}
            />
        );
    }

    if (loading) return <div className="loading">Loading project details...</div>;

    if (error || !project || !metadata) {
        const errorMessage = error || 'Project not found';
        return (
            <div className="error-container">
                <div className="error">
                    <h2>Error Loading Project</h2>
                    <p>{errorMessage}</p>
                    <button onClick={() => navigate('/research')} className="back-button">
                        ← Back to Research Hub
                    </button>
                    <button onClick={() => loadProject()} className="retry-button">
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    const totalFunding = ethers.utils.formatEther(project.totalFunding);
    const currentFunding = ethers.utils.formatEther(project.currentFunding);
    const progressPercentage = (parseFloat(currentFunding) / parseFloat(totalFunding)) * 100;
    const isResearcher = account && project && account.toLowerCase() === project.researcher.toLowerCase();

    // Check if project deadline has passed
    const deadlineTimestamp = project.deadline.toNumber() * 1000; // Convert to milliseconds
    const currentTimestamp = Date.now();
    const isDeadlinePassed = currentTimestamp > deadlineTimestamp;

    return (
        <div className="project-details">
            <button onClick={() => navigate('/research')} className="back-button">
                ← Back to Research Hub
            </button>

            <div className="project-header">
                <h1>{metadata.title}</h1>
                <div className="project-meta">
                    <span className="category">{metadata.category}</span>
                    <span className="researcher">
                        By: {project.researcher.slice(0, 6)}...{project.researcher.slice(-4)}
                    </span>
                    <span className="date">
                        Created: {new Date(metadata.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </div>

            <div className="project-description">
                <h2>About this Research</h2>
                <p>{metadata.description}</p>

                {metadata.files && metadata.files.length > 0 && (
                    <div className="project-files">
                        <h3>Project Files</h3>
                        <ul>
                            {metadata.files.map((cid, index) => (
                                <li key={index}>
                                    <a
                                        href={ipfsService.getIPFSUrl(cid)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View File {index + 1}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="funding-status">
                <h2>Funding Progress</h2>
                <div className="progress-bar">
                    <div
                        className="progress"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="funding-info">
                    <span>{currentFunding} AVAX raised</span>
                    <span>Goal: {totalFunding} AVAX</span>
                </div>

                {project.isActive && !isResearcher && !isDeadlinePassed && (
                    <form onSubmit={handleFund} className="funding-form">
                        <h3>Support this Research</h3>
                        <div className="form-group">
                            <label>Select Milestone to Fund</label>
                            <select
                                value={selectedMilestone}
                                onChange={(e) => setSelectedMilestone(Number(e.target.value))}
                                required
                            >
                                {project.milestones.map((m, idx) => {
                                    const remainingFunding = ethers.utils.formatEther(
                                        m.targetAmount.sub(m.currentAmount)
                                    );
                                    return (
                                        <option key={idx} value={idx} disabled={m.isCompleted}>
                                            Milestone {idx + 1} ({remainingFunding} AVAX remaining)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="input-group">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={fundAmount}
                                onChange={e => setFundAmount(e.target.value)}
                                placeholder="Amount in AVAX"
                                required
                            />
                            <button type="submit" disabled={txPending || !fundAmount}>
                                {txPending ? 'Processing...' : 'Fund Project'}
                            </button>
                        </div>
                        {error && <div className="error-message">{error}</div>}
                    </form>
                )}

                {isDeadlinePassed && (
                    <div className="deadline-passed-notice">
                        <p>Funding deadline has passed. This project is no longer accepting contributions.</p>
                        <p>Deadline: {new Date(deadlineTimestamp).toLocaleDateString()}</p>
                    </div>
                )}
            </div>

            <div className="milestones">
                <h2>Research Milestones</h2>
                {project.milestones.map((milestone: Milestone, index: number) => (
                    <div
                        key={index}
                        className={`milestone ${milestone.isCompleted ? 'completed' : ''}`}
                    >
                        <div className="milestone-header">
                            <h3>Milestone {index + 1}</h3>
                            {milestone.isCompleted && (
                                <span className="status completed">Completed</span>
                            )}
                        </div>

                        <p className="milestone-description">
                            {milestone.description}
                        </p>

                        <div className="milestone-funding">
                            <div className="milestone-progress-bar">
                                <div
                                    className="progress"
                                    style={{
                                        width: `${(milestone.currentAmount.mul(100).div(milestone.targetAmount)).toString()}%`
                                    }}
                                />
                            </div>
                            <div className="funding-info">
                                <span>
                                    {ethers.utils.formatEther(milestone.currentAmount)} / {ethers.utils.formatEther(milestone.targetAmount)} AVAX
                                </span>
                            </div>
                        </div>

                        {!milestone.fundsReleased && (
                            <MilestoneVerificationStatus
                                projectId={id || ''}
                                milestoneId={index.toString()}
                                verificationCriteria={milestone.verificationCriteria}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectDetails;