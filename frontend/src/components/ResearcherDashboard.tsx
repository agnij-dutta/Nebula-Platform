import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ProjectDetails } from '../web3/utils/contracts';
import CreateListing from './CreateListing';
import WalletPrompt from './WalletPrompt';
import './ResearcherDashboard.css';

enum DashboardTab {
    Projects = 'projects',
    IP = 'ip'
}

interface IPToken {
    tokenId: string;
    title: string;
    description: string;
    isListed: boolean;
    price: string;
    creator: string;
}

const ResearcherDashboard: React.FC = () => {
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.Projects);
    const [projects, setProjects] = useState<ProjectDetails[]>([]);
    const [ownedTokens, setOwnedTokens] = useState<IPToken[]>([]);
    const [totalFunding, setTotalFunding] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadProjects = useCallback(async () => {
        if (!contractInterface || !account) return;

        try {
            const maxPossibleProjects = 100;
            const projects = [];
            let total = ethers.BigNumber.from(0);

            for (let i = 1; i <= maxPossibleProjects; i++) {
                try {
                    const project = await contractInterface.getProjectDetails(i.toString());
                    if (project && project.researcher.toLowerCase() === account.toLowerCase()) {
                        projects.push({
                            ...project,
                            projectId: i.toString()
                        });
                        total = total.add(ethers.utils.parseEther(project.currentFunding));
                    }
                } catch (err) {
                    break;
                }
            }

            setProjects(projects);
            setTotalFunding(ethers.utils.formatEther(total));
        } catch (err) {
            console.error('Failed to load projects:', err);
            setError('Failed to load your research projects');
        } finally {
            setLoading(false);
        }
    }, [contractInterface, account]);

    const loadIPTokens = useCallback(async () => {
        if (!contractInterface || !account) return;

        try {
            const tokens = await contractInterface.getOwnedTokens(account);
            setOwnedTokens(tokens);
        } catch (err) {
            console.error('Failed to load IP tokens:', err);
            setError('Failed to load your IP tokens');
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
                    >
                        Research Projects
                    </button>
                    <button
                        className={`tab-button ${activeTab === DashboardTab.IP ? 'active' : ''}`}
                        onClick={() => setActiveTab(DashboardTab.IP)}
                    >
                        IP Portfolio
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : (
                <div className="dashboard-content">
                    {activeTab === DashboardTab.Projects ? renderProjectsTab() : renderIPTab()}
                </div>
            )}
        </div>
    );
};

export default ResearcherDashboard;