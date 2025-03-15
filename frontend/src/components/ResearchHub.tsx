import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
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
  const { contractInterface, needsWallet, connectWallet, isConnecting } = useWeb3();
  const [projects, setProjects] = useState<ProjectDetails[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.Trending);
  const [filterStatus, setFilterStatus] = useState<FundingStatus>(FundingStatus.All);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!contractInterface) return;
    
    setLoading(true);
    try {
      const researchProject = await contractInterface.getResearchProject();
      let projectCount = 0;
      let currentId = 1;
      const projects = [];

      // Keep trying to fetch projects until we hit an invalid ID
      while (true) {
        try {
          const project = await contractInterface.getProjectDetails(currentId.toString());
          if (project) {
            projects.push(project);
            currentId++;
            projectCount++;
          }
        } catch (err) {
          // If we hit an invalid ID, we've found all projects
          break;
        }
      }
      
      let allProjects = projects;
      
      // Apply filters
      if (filterStatus !== FundingStatus.All) {
        allProjects = allProjects.filter((p): p is ProjectDetails => {
          if (!p) return false;
          return filterStatus === FundingStatus.Active ? p.isActive : !p.isActive;
        });
      }
      
      if (selectedCategory !== 'all') {
        allProjects = allProjects.filter((p): p is ProjectDetails => {
          if (!p) return false;
          return p.category === selectedCategory;
        });
      }
      
      // Apply sorting
      switch (sortBy) {
        case SortOption.Newest:
          allProjects.sort((a, b) => b.createdAt - a.createdAt);
          break;
        case SortOption.MostFunded:
          allProjects.sort((a, b) => parseFloat(b.currentFunding) - parseFloat(a.currentFunding));
          break;
        case SortOption.Trending:
          // Enhanced trending algorithm: recent projects with good funding progress
          allProjects.sort((a, b) => {
            const aProgress = parseFloat(a.currentFunding) / parseFloat(a.totalFunding);
            const bProgress = parseFloat(b.currentFunding) / parseFloat(b.totalFunding);
            const aAge = (Date.now()/1000 - a.createdAt) / 86400; // age in days
            const bAge = (Date.now()/1000 - b.createdAt) / 86400;
            
            const aScore = aProgress * (1 + 1 / Math.sqrt(1 + aAge));
            const bScore = bProgress * (1 + 1 / Math.sqrt(1 + bAge));
            
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
  }, [contractInterface, sortBy, filterStatus, selectedCategory, loadProjects]);

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
        <div className="filters">
          <select 
            value={selectedCategory} 
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="biotech">Biotech</option>
            <option value="ai">Artificial Intelligence</option>
            <option value="cleantech">Clean Technology</option>
            <option value="quantum">Quantum Computing</option>
            <option value="other">Other</option>
          </select>
          
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(Number(e.target.value))}
          >
            <option value={FundingStatus.All}>All Projects</option>
            <option value={FundingStatus.Active}>Active</option>
            <option value={FundingStatus.Completed}>Completed</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={e => setSortBy(Number(e.target.value))}
          >
            <option value={SortOption.Trending}>Trending</option>
            <option value={SortOption.Newest}>Newest</option>
            <option value={SortOption.MostFunded}>Most Funded</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project.projectId} className="project-card">
              <h3>{project.title}</h3>
              <p className="description">{project.description}</p>
              <div className="project-stats">
                <div className="funding-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress" 
                      style={{ 
                        width: `${(parseFloat(project.currentFunding) / parseFloat(project.totalFunding)) * 100}%` 
                      }}
                    />
                  </div>
                  <span>
                    {project.currentFunding} / {project.totalFunding} AVAX
                  </span>
                </div>
                <div className="milestones">
                  <span>
                    {project.milestones.filter((m: { isCompleted: boolean }) => m.isCompleted).length} / {project.milestones.length} Milestones
                  </span>
                </div>
                <div className="category-tag">{project.category}</div>
              </div>
              <button 
                className="view-details"
                onClick={() => window.location.href = `/project/${project.projectId}`}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResearchHub;