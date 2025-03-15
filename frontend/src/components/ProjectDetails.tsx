import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ProjectDetails as IProjectDetails } from '../web3/utils/contracts';
import MilestoneVerification from './MilestoneVerification';
import MilestoneVerificationStatus from './MilestoneVerificationStatus';
import WalletPrompt from './WalletPrompt';
import './ProjectDetails.css';

interface MilestoneType {
  isCompleted: boolean;
  description: string;
  currentAmount: string;
  targetAmount: string;
  fundsReleased?: boolean;
  verificationCID?: string;
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
  const [project, setProject] = useState<IProjectDetails | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txPending, setTxPending] = useState(false);

  const loadProject = async () => {
    if (!contractInterface || !id) return;
    try {
      const projectDetails = await contractInterface.getProjectDetails(id);
      setProject(projectDetails);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id, contractInterface]);

  // Added missing dependency
  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractInterface || !account || !project || !id) return;

    setTxPending(true);
    setError('');
    
    try {
      const tx = await contractInterface.fundProject(id, fundAmount);
      await tx.wait();
      await loadProject(); // Reload project details
      setFundAmount('');
    } catch (err: any) {
      console.error('Funding failed:', err);
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
  if (error) return <div className="error">{error}</div>;
  if (!project) return <div className="error">Project not found</div>;

  const progressPercentage = (parseFloat(project.currentFunding) / parseFloat(project.totalFunding)) * 100;
  const isResearcher = account && project && account.toLowerCase() === project.researcher.toLowerCase();

  return (
    <div className="project-details">
      <h1>{project.title}</h1>
      
      <div className="project-meta">
        <span className="category">{project.category}</span>
        <span className="researcher">
          Created by: {project.researcher.slice(0, 6)}...{project.researcher.slice(-4)}
        </span>
        <span className="date">
          Created: {new Date(project.createdAt * 1000).toLocaleDateString()}
        </span>
      </div>

      <div className="project-description">
        <h2>About this Research</h2>
        <p>{project.description}</p>
      </div>

      <div className="funding-status">
        <h2>Funding Progress</h2>
        <div className="progress-bar">
          <div 
            className="progress" 
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="funding-numbers">
          <span>{project.currentFunding} AVAX raised</span>
          <span>Goal: {project.totalFunding} AVAX</span>
        </div>
      </div>

      <div className="milestones">
        <h2>Research Milestones</h2>
        {project.milestones.map((milestone: MilestoneType, index: number) => (
          <div 
            key={index} 
            className={`milestone ${milestone.isCompleted ? 'completed' : ''}`}
          >
            <div className="milestone-header">
              <h3>Milestone {index + 1}</h3>
              <span className={`status ${milestone.isCompleted ? 'completed' : ''}`}>
                {milestone.isCompleted ? 'Completed' : 'In Progress'}
              </span>
            </div>
            <p>{milestone.description}</p>
            <div className="milestone-funding">
              <div className="milestone-progress-bar">
                <div 
                  className="progress" 
                  style={{ 
                    width: `${(parseFloat(milestone.currentAmount) / parseFloat(milestone.targetAmount)) * 100}%` 
                  }}
                />
              </div>
              <span>{milestone.currentAmount} / {milestone.targetAmount} AVAX</span>
            </div>
            
            {/* Add verification components */}
            {isResearcher && milestone.isCompleted && !milestone.fundsReleased && (
              <div className="milestone-verification">
                <MilestoneVerification
                  projectId={id || ''}
                  milestoneId={(index + 1).toString()}
                  verificationCID={milestone.verificationCID || ''}
                  onVerificationSubmitted={loadProject}
                />
              </div>
            )}
            
            {milestone.verificationCID && (
              <MilestoneVerificationStatus
                projectId={id || ''}
                milestoneId={(index + 1).toString()}
                verificationCID={milestone.verificationCID}
              />
            )}
          </div>
        ))}
      </div>

      {project.isActive && (
        <div className="funding-form">
          <h2>Support this Research</h2>
          <form onSubmit={handleFund}>
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
              <button type="submit" disabled={txPending}>
                {txPending ? 'Processing...' : 'Fund Project'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;