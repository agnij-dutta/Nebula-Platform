import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import { ProjectDetails } from '../web3/utils/contracts';
import { IPTokenData } from '../types/ipTokens';
import CreateListing from './CreateListing';
import WalletPrompt from './WalletPrompt';
import ErrorDisplay from './ErrorDisplay';
import './ResearcherDashboard.css';

enum DashboardTab {
    Projects = 'projects',
    IP = 'ip'
}

const ResearcherDashboard: React.FC = () => {
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3Context();
    const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.Projects);
    const [projects, setProjects] = useState<ProjectDetails[]>([]);
    const [ownedTokens, setOwnedTokens] = useState<IPTokenData[]>([]);
    const [totalFunding, setTotalFunding] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isRetrying, setIsRetrying] = useState(false);

    const loadIPTokens = useCallback(async () => {
        if (!contractInterface || !account) return;
        setLoading(true);
        setError('');
        
        try {
            const tokens = await contractInterface.getOwnedTokens(account);
            setOwnedTokens(tokens);
        } catch (err: any) {
            console.error('Failed to load IP tokens:', err);
            let errorMessage = 'Failed to load your IP tokens. Please try again.';
            
            if (err?.code === -32603 || err?.message?.includes('network')) {
                errorMessage = 'Network connection error. Please check your connection and try again.';
            } else if (err?.message?.includes('user rejected') || err?.code === 4001) {
                errorMessage = 'Request was rejected. Please try again.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    }, [contractInterface, account]);

    const loadProjects = useCallback(async () => {
        if (!contractInterface || !account) return;
        setLoading(true);
        setError('');
        try {
            const maxPossibleProjects = 100;
            const projects = [];
            let total = ethers.BigNumber.from(0);
            let seenTitles = new Set();

            for (let projectId = 1; projectId <= maxPossibleProjects; projectId++) {
                try {
                    const project = await contractInterface.getProjectDetails(projectId.toString());
                    if (project && project.researcher.toLowerCase() === account.toLowerCase()) {
                        // Only add the project if we haven't seen this title before
                        if (!seenTitles.has(project.title.toLowerCase())) {
                            seenTitles.add(project.title.toLowerCase());
                            projects.push({
                                ...project,
                                projectId: projectId.toString()
                            });
                            total = total.add(ethers.utils.parseEther(project.currentFunding));
                        }
                    }
                } catch (err: any) {
                    // Only break if we get a "Project not found" error
                    if (err?.message?.includes('Project not found')) {
                        break;
                    }
                    console.error(`Error loading project ${projectId}:`, err);
                    if (err?.code === -32603) {
                        throw new Error('Network error. Please check your connection and try again.');
                    }
                    // Continue to next project if it's a different kind of error
                    continue;
                }
            }

            setProjects(projects);
            setTotalFunding(ethers.utils.formatEther(total));
        } catch (err: any) {
            console.error('Failed to load projects:', err);
            setError(err?.message || 'Failed to load your research projects');
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    }, [contractInterface, account]);

    useEffect(() => {
        if (activeTab === DashboardTab.Projects) {
            loadProjects();
        } else {
            loadIPTokens();
        }
    }, [activeTab, loadProjects, loadIPTokens]);

    const handleListingCreated = () => {
        loadIPTokens();
    };

    const handleRetry = useCallback(() => {
        setIsRetrying(true);
        if (activeTab === DashboardTab.Projects) {
            loadProjects();
        } else {
            loadIPTokens();
        }
    }, [activeTab, loadProjects, loadIPTokens]);

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to view your dashboard"
                onConnect={connectWallet}
            />
        );
    }

    const renderProjectsTab = () => (
        <>
            <div className="dashboard-stats">
                <div className="stat-card">
                    <h3>Total Projects</h3>
                    <p>{projects.length}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Funding Received</h3>
                    <p>{totalFunding} AVAX</p>
                </div>
            </div>

            <div className="projects-section">
                <div className="section-header">
                    <h2>Your Research Projects</h2>
                    <Link to="/create-research" className="create-button">
                        Create New Project
                    </Link>
                </div>
                
                {projects.length === 0 ? (
                    <div className="no-items">
                        <p>You haven't created any research projects yet.</p>
                        <Link to="/create-research" className="create-first">
                            Create Your First Project
                        </Link>
                    </div>
                ) : (
                    <div className="items-grid">
                        {projects.map(project => {
                            const progressPercentage = (parseFloat(project.currentFunding) / parseFloat(project.totalFunding)) * 100;
                            const completedMilestones = project.milestones.filter((m: any) => m.isCompleted).length;
                            
                            return (
                                <div key={project.projectId} className="item-card">
                                    <div className="item-header">
                                        <h3>{project.title}</h3>
                                        <span className={`status ${project.isActive ? 'active' : 'completed'}`}>
                                            {project.isActive ? 'Active' : 'Completed'}
                                        </span>
                                    </div>
                                    
                                    <div className="item-stats">
                                        <div className="funding-progress">
                                            <div className="progress-bar">
                                                <div 
                                                    className="progress" 
                                                    style={{ width: `${progressPercentage}%` }}
                                                />
                                            </div>
                                            <div className="funding-info">
                                                <span>{project.currentFunding} AVAX raised</span>
                                                <span>Goal: {project.totalFunding} AVAX</span>
                                            </div>
                                        </div>
                                        
                                        <div className="milestone-progress">
                                            <span>Milestones: {completedMilestones} / {project.milestones.length}</span>
                                        </div>
                                    </div>

                                    <Link 
                                        to={`/project/${project.projectId}`} 
                                        className="view-details"
                                    >
                                        View Details
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );

    const renderIPTab = () => (
        <>
            <div className="dashboard-stats">
                <div className="stat-card">
                    <h3>Total IP Tokens</h3>
                    <p>{ownedTokens.length}</p>
                </div>
                <div className="stat-card">
                    <h3>Listed Tokens</h3>
                    <p>{ownedTokens.filter(t => t.isListed).length}</p>
                </div>
            </div>

            <div className="ip-section">
                <div className="section-header">
                    <h2>Your IP Tokens</h2>
                    <Link to="/create-ip" className="create-button">
                        Create New IP
                    </Link>
                </div>

                {ownedTokens.length === 0 ? (
                    <div className="no-items">
                        <p>You don't own any IP tokens yet.</p>
                        <Link to="/create-ip" className="create-first">
                            Create Your First IP Token
                        </Link>
                    </div>
                ) : (
                    <div className="items-grid">
                        {ownedTokens.map(token => (
                            <div key={token.tokenId} className="item-card">
                                <div className="item-header">
                                    <h3>{token.title}</h3>
                                    <span className={`status ${token.isListed ? 'active' : 'unlisted'}`}>
                                        {token.isListed ? 'Listed' : 'Unlisted'}
                                    </span>
                                </div>
                                
                                <p className="description">{token.description}</p>
                                
                                {token.isListed ? (
                                    <div className="price-info">
                                        <span>Listed Price: {ethers.utils.formatEther(token.price)} AVAX</span>
                                    </div>
                                ) : (
                                    <CreateListing
                                        initialTokenId={token.tokenId}
                                        onListingCreated={handleListingCreated}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    return (
        <div className="researcher-dashboard">
            <div className="dashboard-header">
                <h1>Researcher Dashboard</h1>
                <div className="tab-navigation">
                    <button
                        className={`tab-button ${activeTab === DashboardTab.Projects ? 'active' : ''}`}
                        onClick={() => setActiveTab(DashboardTab.Projects)}
                        disabled={loading || isRetrying}
                    >
                        Research Projects
                    </button>
                    <button
                        className={`tab-button ${activeTab === DashboardTab.IP ? 'active' : ''}`}
                        onClick={() => setActiveTab(DashboardTab.IP)}
                        disabled={loading || isRetrying}
                    >
                        IP Portfolio
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">
                    {isRetrying ? 'Retrying...' : 'Loading...'}
                </div>
            ) : error ? (
                <ErrorDisplay 
                    message={error}
                    onRetry={handleRetry}
                />
            ) : (
                <div className="dashboard-content">
                    {activeTab === DashboardTab.Projects ? renderProjectsTab() : renderIPTab()}
                </div>
            )}
        </div>
    );
};

export default ResearcherDashboard;