import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import WalletPrompt from './WalletPrompt';
import './Governance.css';
import { WEB3_CONFIG } from '../web3/config';

enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed
}

interface Proposal {
  id: string;
  proposer: string;
  description: string;
  startBlock: number;
  endBlock: number;
  state: ProposalState;
  forVotes: string;
  againstVotes: string;
}

const Governance: React.FC = () => {
  const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [neblBalance, setNeblBalance] = useState('0');
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalForm, setProposalForm] = useState({
    title: '',
    description: '',
    targetContract: '',
    functionSignature: '',
    parameters: ''
  });

  const loadProposalsInBatches = useCallback(async (governance: any, fromBlock: number, toBlock: number) => {
    const batchSize = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.batchSize;
    const events = [];
    
    for (let start = fromBlock; start <= toBlock; start += batchSize) {
        const end = Math.min(start + batchSize - 1, toBlock);
        let retries = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries;
        
        while (retries >= 0) {
            try {
                const batchEvents = await governance.queryFilter(
                    governance.filters.ProposalCreated(),
                    start,
                    end
                );
                events.push(...batchEvents);
                break;
            } catch (err) {
                if (retries === 0) throw err;
                retries--;
                await new Promise(resolve => 
                    setTimeout(resolve, 
                        WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(
                            WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries - retries
                        )
                    )
                );
            }
        }
    }
    return events;
  }, []);

  const loadProposals = useCallback(async () => {
    if (!contractInterface) return;
    setLoading(true);
    setError(null);
    
    try {
      const governance = await contractInterface.getGovernance();
      const provider = governance.provider;

      // Get latest block with retries
      let latestBlock = 0;
      let retries = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries;
      
      while (retries >= 0) {
          try {
              latestBlock = await provider.getBlockNumber();
              break;
          } catch (err) {
              if (retries === 0) throw err;
              retries--;
              await new Promise(resolve => 
                  setTimeout(resolve, 
                      WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(
                          WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries - retries
                      )
                  )
              );
          }
      }

      // Get events in batches with exponential backoff retry
      const fromBlock = Math.max(0, latestBlock - 100_000); // Last ~2 weeks of blocks
      const events = await loadProposalsInBatches(governance, fromBlock, latestBlock);

      const proposalPromises = events.map(async (event) => {
          try {
              const proposalId = event.args?.proposalId.toString();
              const [state, votes] = await Promise.all([
                  governance.state(proposalId).catch(() => 0), // Default to Pending state on error
                  governance.proposalVotes(proposalId).catch(() => ({ forVotes: 0, againstVotes: 0 }))
              ]);

              return {
                  id: proposalId,
                  proposer: event.args?.proposer,
                  description: event.args?.description,
                  startBlock: event.args?.startBlock.toNumber(),
                  endBlock: event.args?.endBlock.toNumber(),
                  state,
                  forVotes: ethers.utils.formatEther(votes.forVotes || 0),
                  againstVotes: ethers.utils.formatEther(votes.againstVotes || 0)
              };
          } catch (err) {
              console.error('Failed to load proposal details:', err);
              return null;
          }
      });

      const loadedProposals = (await Promise.all(proposalPromises))
          .filter((p): p is Proposal => p !== null)
          .sort((a, b) => b.startBlock - a.startBlock);

      setProposals(loadedProposals);
    } catch (err: any) {
      console.error('Failed to load proposals:', err);
      setError(err.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [contractInterface, loadProposalsInBatches]);

  const loadNeblBalance = useCallback(async () => {
    if (!contractInterface || !account) return;
    
    try {
      const neblToken = await contractInterface.getNEBLToken();
      const balance = await neblToken.balanceOf(account);
      setNeblBalance(ethers.utils.formatEther(balance));
    } catch (err) {
      console.error('Failed to load NEBL balance:', err);
    }
  }, [contractInterface, account]);

  useEffect(() => {
    if (contractInterface && account) {
      loadProposals();
      loadNeblBalance();
    }
  }, [contractInterface, account, loadProposals, loadNeblBalance]);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractInterface) return;

    setIsCreatingProposal(true);
    try {
      const description = `${proposalForm.title}\n\n${proposalForm.description}`;
      const targets = [proposalForm.targetContract];
      const values = [0];
      const calldatas = [
        ethers.utils.defaultAbiCoder.encode(
          ['string'], 
          [proposalForm.parameters]
        )
      ];

      await contractInterface.createProposal(
        targets,
        values,
        calldatas,
        description
      );

      // Reset form
      setProposalForm({
        title: '',
        description: '',
        targetContract: '',
        functionSignature: '',
        parameters: ''
      });

      await loadProposals();
    } catch (err) {
      console.error('Failed to create proposal:', err);
    } finally {
      setIsCreatingProposal(false);
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    if (!contractInterface) return;
    
    try {
      await contractInterface.castVote(proposalId, support);
      await loadProposals();
    } catch (err) {
      console.error('Failed to cast vote:', err);
    }
  };

  const getProposalStateText = (state: ProposalState) => {
    switch (state) {
      case ProposalState.Pending: return 'Pending';
      case ProposalState.Active: return 'Active';
      case ProposalState.Canceled: return 'Canceled';
      case ProposalState.Defeated: return 'Defeated';
      case ProposalState.Succeeded: return 'Succeeded';
      case ProposalState.Queued: return 'Queued';
      case ProposalState.Expired: return 'Expired';
      case ProposalState.Executed: return 'Executed';
      default: return 'Unknown';
    }
  };

  if (needsWallet) {
    return (
      <WalletPrompt 
        message="Connect your wallet to participate in governance decisions"
        onConnect={connectWallet}
      />
    );
  }

  return (
    <div className="governance">
      <div className="governance-header">
        <h1>Governance</h1>
        <div className="nebl-balance">
          Your Voting Power: {neblBalance} NEBL
        </div>
      </div>

      {error ? (
        <div className="error-message">{error}</div>
      ) : loading ? (
        <div className="loading">Loading proposals...</div>
      ) : (
        <div className="proposals-section">
          <h2>Active Proposals</h2>
          <div className="proposals-list">
            {proposals.map(proposal => (
              <div key={proposal.id} className="proposal-card">
                <div className="proposal-header">
                  <h3>{proposal.description.split('\n')[0]}</h3>
                  <span className={`proposal-state ${proposal.state}`}>
                    {getProposalStateText(proposal.state)}
                  </span>
                </div>
                <p className="proposal-description">
                  {proposal.description.split('\n').slice(1).join('\n')}
                </p>
                <div className="proposal-stats">
                  <div className="votes">
                    <div className="vote-bar">
                      <div 
                        className="for" 
                        style={{ 
                          width: `${Number(proposal.forVotes) / (Number(proposal.forVotes) + Number(proposal.againstVotes)) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="vote-numbers">
                      <span>For: {proposal.forVotes}</span>
                      <span>Against: {proposal.againstVotes}</span>
                    </div>
                  </div>
                </div>
                {proposal.state === ProposalState.Active && (
                  <div className="vote-buttons">
                    <button onClick={() => handleVote(proposal.id, true)}>Vote For</button>
                    <button onClick={() => handleVote(proposal.id, false)}>Vote Against</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="create-proposal">
        <h2>Create Proposal</h2>
        <form onSubmit={handleCreateProposal}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={proposalForm.title}
              onChange={e => setProposalForm({...proposalForm, title: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={proposalForm.description}
              onChange={e => setProposalForm({...proposalForm, description: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Target Contract</label>
            <input
              type="text"
              value={proposalForm.targetContract}
              onChange={e => setProposalForm({...proposalForm, targetContract: e.target.value})}
              placeholder="Contract address"
              required
            />
          </div>
          <div className="form-group">
            <label>Function Signature</label>
            <input
              type="text"
              value={proposalForm.functionSignature}
              onChange={e => setProposalForm({...proposalForm, functionSignature: e.target.value})}
              placeholder="e.g., transfer(address,uint256)"
              required
            />
          </div>
          <div className="form-group">
            <label>Parameters</label>
            <input
              type="text"
              value={proposalForm.parameters}
              onChange={e => setProposalForm({...proposalForm, parameters: e.target.value})}
              placeholder="Comma-separated parameters"
              required
            />
          </div>
          <button type="submit" disabled={isCreatingProposal}>
            {isCreatingProposal ? 'Creating...' : 'Create Proposal'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Governance;