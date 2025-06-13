import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import WalletPrompt from './WalletPrompt';
import ErrorDisplay from './ErrorDisplay';
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
      const { contractInterface, account, needsWallet, connectWallet } = useWeb3Context();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [neblBalance, setNeblBalance] = useState('0');
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    title: '',
    description: '',
    targetContract: '',
    functionSignature: '',
    parameters: ''
  });

  const loadProposalsInBatches = useCallback(async (governance: any, fromBlock: number, toBlock: number) => {
    const batchSize = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.batchSize;
    const events: ethers.Event[] = [];
    
    const retryQueryFilter = async (start: number, end: number, retriesLeft: number): Promise<void> => {
      try {
        const batchEvents = await governance.queryFilter(
          governance.filters.ProposalCreated(),
          start,
          end
        );
        events.push(...batchEvents);
      } catch (err) {
        if (retriesLeft === 0) throw err;
        await new Promise(resolve => 
          setTimeout(resolve, 
            WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(
              WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries - retriesLeft
            )
          )
        );
        await retryQueryFilter(start, end, retriesLeft - 1);
      }
    };

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, toBlock);
      await retryQueryFilter(start, end, WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries);
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
      
      const getLatestBlockWithRetry = async (retriesLeft: number): Promise<number> => {
        try {
          return await provider.getBlockNumber();
        } catch (err) {
          if (retriesLeft === 0) {
            throw new Error('Network error: Failed to get latest block number. Please try again.');
          }
          await new Promise(resolve => 
            setTimeout(resolve, 
              WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(
                WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries - retriesLeft
              )
            )
          );
          return getLatestBlockWithRetry(retriesLeft - 1);
        }
      };

      const latestBlock = await getLatestBlockWithRetry(WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries);

      const fromBlock = Math.max(0, latestBlock - 100_000);
      const events = await loadProposalsInBatches(governance, fromBlock, latestBlock);

      const proposalPromises = events.map(async (event) => {
          try {
              const proposalId = event.args?.proposalId.toString();
              const [state, votes] = await Promise.all([
                  governance.state(proposalId).catch(() => 0),
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
      if (err?.code === -32603) {
          setError('Network error: Failed to load proposals. Please check your connection and try again.');
      } else {
          setError(err.message || 'Failed to load proposals');
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [contractInterface, loadProposalsInBatches]);

  const loadNeblBalance = useCallback(async () => {
    if (!contractInterface || !account) return;
    
    try {
      const neblToken = await contractInterface.getNEBLToken();
      const balance = await neblToken.balanceOf(account);
      setNeblBalance(ethers.utils.formatEther(balance));
    } catch (err: any) {
      console.error('Failed to load NEBL balance:', err);
      if (err?.code === -32603) {
          console.warn('Network error while loading NEBL balance, will retry on next update');
      }
    }
  }, [contractInterface, account]);

  useEffect(() => {
    if (contractInterface && account) {
      loadProposals();
      loadNeblBalance();
    }
  }, [contractInterface, account, loadProposals, loadNeblBalance]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    loadProposals();
  }, [loadProposals]);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractInterface) return;

    setIsCreatingProposal(true);
    setError(null);
    
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

      setProposalForm({
        title: '',
        description: '',
        targetContract: '',
        functionSignature: '',
        parameters: ''
      });

      await loadProposals();
    } catch (err: any) {
      console.error('Failed to create proposal:', err);
      if (err?.code === -32603) {
          setError('Network error: Failed to create proposal. Please check your connection and try again.');
      } else {
          setError(err.message || 'Failed to create proposal');
      }
    } finally {
      setIsCreatingProposal(false);
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    if (!contractInterface) return;
    setError(null);
    
    const retryVote = async (currentTry: number, maxRetries: number): Promise<void> => {
      try {
        const tx = await contractInterface.castVote(proposalId, support);
        await tx.wait();
        await loadProposals();
      } catch (err) {
        if (currentTry < maxRetries) {
          console.warn(`Vote attempt ${currentTry + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentTry) * 1000));
          await retryVote(currentTry + 1, maxRetries);
        } else {
          throw err;
        }
      }
    };

    try {
      await retryVote(0, 3);
    } catch (err: any) {
      console.error('Failed to cast vote:', err);
      if (err?.code === -32603) {
        setError('Network error: Failed to cast vote. Please check your connection and try again.');
      } else {
        setError(err.message || 'Failed to cast vote');
      }
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
        <ErrorDisplay 
          message={error}
          onRetry={handleRetry}
        />
      ) : loading ? (
        <div className="loading">
          {isRetrying ? 'Retrying...' : 'Loading proposals...'}
        </div>
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