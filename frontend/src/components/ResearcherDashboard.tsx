import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ProjectDetails } from '../web3/utils/contracts';
import WalletPrompt from './WalletPrompt';
import './ResearcherDashboard.css';

const ResearcherDashboard: React.FC = () => {
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [projects, setProjects] = useState<ProjectDetails[]>([]);
    const [totalFunding, setTotalFunding] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadProjects = useCallback(async () => {
        if (!contractInterface || !account) return;

        setLoading(true);
        try {
            const maxPossibleProjects = 100; // Adjust based on expected scale
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
                    // If we get an error, assume we've hit the end of valid projects
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

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to view your research dashboard"
                onConnect={connectWallet}
            />
        );
    }

    return (
        <div className="researcher-dashboard">
            <div className="dashboard-header">
                <h1>Researcher Dashboard</h1>
                <Link to="/create-research" className="create-project-button">
                    Create New Project
                </Link>
            </div>

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

            {loading ? (
                <div className="loading">Loading your projects...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : (
                <div className="projects-section">
                    <h2>Your Research Projects</h2>
                    
                    {projects.length === 0 ? (
                        <div className="no-projects">
                            <p>You haven't created any research projects yet.</p>
                            <Link to="/create-research" className="create-first-project">
                                Create Your First Project
                            </Link>
                        </div>
                    ) : (
                        <div className="projects-grid">
                            {projects.map(project => {
                                const progressPercentage = (parseFloat(project.currentFunding) / parseFloat(project.totalFunding)) * 100;
                                const completedMilestones = project.milestones.filter((m: any) => m.isCompleted).length;
                                
                                return (
                                    <div key={project.projectId} className="project-card">
                                        <div className="project-header">
                                            <h3>{project.title}</h3>
                                            <span className={`status ${project.isActive ? 'active' : 'completed'}`}>
                                                {project.isActive ? 'Active' : 'Completed'}
                                            </span>
                                        </div>
                                        
                                        <div className="project-stats">
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
            )}
        </div>
    );
};

export default ResearcherDashboard;