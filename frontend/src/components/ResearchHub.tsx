import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import { ProjectDetails } from '../web3/utils/contracts';
import WalletPrompt from './WalletPrompt';
import './ResearchHub.css';

enum SortOption {
  Trending,
  Newest,
  MostFunded
}

enum FundingStatus {
  All,
  Active,
  Completed
}

const ResearchHub: React.FC = () => {
  const { contractInterface, account, needsWallet, connectWallet, isConnecting } = useWeb3Context();
  const [projects, setProjects] = useState<ProjectDetails[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.Trending);
  const [filterStatus, setFilterStatus] = useState<FundingStatus>(FundingStatus.All);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!contractInterface) return;
    
    setLoading(true);
    try {
      const maxPossibleProjects = 100; // Set a reasonable upper limit
      let allProjects = [];
      let seenTitles = new Set();
      let consecutiveFailures = 0;
      
      for (let projectId = 1; projectId <= maxPossibleProjects; projectId++) {
        try {
          console.log(`Attempting to get project details for ID: ${projectId}`);
          const project = await contractInterface.getProjectDetails(projectId.toString());
          console.log(`Successfully loaded project details for ID ${projectId}:`, project);
          
          if (project) {
            if (!seenTitles.has(project.title.toLowerCase())) {
              seenTitles.add(project.title.toLowerCase());
              allProjects.push(project);
              consecutiveFailures = 0; // Reset failure counter on success
            }
          }
        } catch (err: any) {
          consecutiveFailures++;
          console.error(`Error loading project ${projectId}:`, err);
          
          if (err?.message?.includes('Project not found') || err?.message?.includes('execution reverted')) {
            // If we get multiple consecutive failures, assume we've reached the end
            if (consecutiveFailures >= 3) {
              console.log(`Stopping project loading after ${consecutiveFailures} consecutive failures`);
              break;
            }
            continue;
          }
          
          // For other errors (RPC issues), continue trying but limit attempts
          if (consecutiveFailures >= 5) {
            console.log(`Too many consecutive RPC failures, stopping at project ${projectId}`);
            break;
          }
          continue;
        }
      }

      // Apply filters
      if (filterStatus !== FundingStatus.All) {
        allProjects = allProjects.filter(p => 
          filterStatus === FundingStatus.Active ? p.isActive : !p.isActive
        );
      }
      
      if (selectedCategory !== 'all') {
        allProjects = allProjects.filter(p => 
          p.category.toLowerCase() === selectedCategory.toLowerCase()
        );
      }

      // Apply sorting
      switch (sortBy) {
        case SortOption.Newest:
          allProjects.sort((a, b) => b.createdAt - a.createdAt);
          break;
        case SortOption.MostFunded:
          allProjects.sort((a, b) => {
            const aFunding = parseFloat(a.currentFunding);
            const bFunding = parseFloat(b.currentFunding);
            return bFunding - aFunding;
          });
          break;
        case SortOption.Trending:
          allProjects.sort((a, b) => {
            const aFunding = parseFloat(a.currentFunding);
            const bFunding = parseFloat(b.currentFunding);
            const aTotal = parseFloat(a.totalFunding);
            const bTotal = parseFloat(b.totalFunding);
            const aProgress = aFunding / aTotal;
            const bProgress = bFunding / bTotal;
            const aAge = (Date.now()/1000 - a.createdAt) / 86400;
            const bAge = (Date.now()/1000 - b.createdAt) / 86400;
            const aScore = aProgress * (1 + 1/Math.sqrt(1 + aAge));
            const bScore = bProgress * (1 + 1/Math.sqrt(1 + bAge));
            return bScore - aScore;
          });
          break;
      }

      setProjects(allProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [contractInterface, sortBy, filterStatus, selectedCategory]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  if (needsWallet) {
    return (
      <WalletPrompt 
        message="Connect your wallet to explore and fund research projects"
        onConnect={connectWallet}
        isLoading={isConnecting}
      />
    );
  }

  return (
    <div className="research-hub">
      <div className="research-hub-header">
        <h1>Research Hub</h1>
        <div className="header-actions">
          <div className="filters">
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="biotech">Biotechnology</option>
              <option value="ai">Artificial Intelligence</option>
              <option value="cleantech">Clean Technology</option>
              <option value="medicine">Medicine</option>
              <option value="physics">Physics</option>
              <option value="other">Other</option>
            </select>

            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(Number(e.target.value))}
            >
              <option value={FundingStatus.All}>All Status</option>
              <option value={FundingStatus.Active}>Active</option>
              <option value={FundingStatus.Completed}>Completed</option>
            </select>

            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(Number(e.target.value))}
            >
              <option value={SortOption.Trending}>Trending</option>
              <option value={SortOption.Newest}>Newest</option>
              <option value={SortOption.MostFunded}>Most Funded</option>
            </select>
          </div>
          
          <Link to="/create-project" className="create-project-button">
            Create Project
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => {
            const isOwner = account && account.toLowerCase() === project.researcher.toLowerCase();
            const progressPercentage = (parseFloat(project.currentFunding) / parseFloat(project.totalFunding)) * 100;
            
            return (
              <div key={project.projectId} className="project-card">
                <div className="project-header">
                  <h3>{project.title}</h3>
                  <span className="category-tag">{project.category}</span>
                </div>
                
                <p className="description">{project.description}</p>
                
                <div className="project-stats">
                  <div className="funding-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress" 
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <div className="funding-info">
                      <span>{parseFloat(project.currentFunding).toFixed(2)} AVAX raised</span>
                      <span>Goal: {parseFloat(project.totalFunding).toFixed(2)} AVAX</span>
                    </div>
                  </div>
                </div>
                
                <div className="project-meta">
                  <span className="researcher">
                    By: {project.researcher.slice(0, 6)}...{project.researcher.slice(-4)}
                  </span>
                  <span className="deadline">
                    Deadline: {new Date(project.deadline * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div className="card-actions">
                  <Link 
                    to={`/project/${project.projectId}`} 
                    className="view-details"
                  >
                    View Details
                  </Link>
                  
                  {project.isActive && !isOwner && (
                    <Link 
                      to={`/project/${project.projectId}`} 
                      className="fund-project"
                    >
                      Fund Project
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          
          {projects.length === 0 && !loading && (
            <div className="no-projects">
              <p>No research projects found matching your criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResearchHub;