import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDisputes, Evidence } from '../web3/hooks/useDisputes';
import { useWeb3 } from '../web3/hooks/useWeb3';
import WalletPrompt from './WalletPrompt';
import './DisputeDetails.css';

const DisputeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { needsWallet, connectWallet, account, isConnecting } = useWeb3();
  const { 
    dispute,
    complainantEvidence,
    respondentEvidence,
    loading,
    error,
    submitEvidence,
    getDisputeTypeString,
    getDisputeStatusString,
    refreshDispute
  } = useDisputes(id);

  const [newEvidence, setNewEvidence] = useState({
    description: '',
    ipfsHash: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const canSubmitEvidence = () => {
    if (!dispute || !account) return false;
    return (
      dispute.status === 0 && // Active
      (account.toLowerCase() === dispute.complainant.toLowerCase() ||
       account.toLowerCase() === dispute.respondent.toLowerCase())
    );
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitEvidence() || !id) return;

    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      await submitEvidence(
        id,
        newEvidence.description,
        newEvidence.ipfsHash
      );
      await refreshDispute();
      setNewEvidence({ description: '', ipfsHash: '' });
      setSubmitSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit evidence');
    } finally {
      setSubmitting(false);
    }
  };

  if (needsWallet) {
    return (
      <WalletPrompt 
        message="Connect your wallet to view and participate in dispute resolution"
        onConnect={connectWallet}
        isLoading={isConnecting}
      />
    );
  }

  if (loading) {
    return <div className="loading">Loading dispute details...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!dispute) {
    return <div className="error">Dispute not found</div>;
  }

  return (
    <div className="dispute-details">
      <h1>Dispute #{id}</h1>
      
      <div className="dispute-info">
        <div className="info-row">
          <span>Type:</span>
          <span>{getDisputeTypeString(dispute.disputeType)}</span>
        </div>
        <div className="info-row">
          <span>Status:</span>
          <span className={`status ${getDisputeStatusString(dispute.status).toLowerCase()}`}>
            {getDisputeStatusString(dispute.status)}
          </span>
        </div>
        <div className="info-row">
          <span>Complainant:</span>
          <span className="address">{dispute.complainant}</span>
        </div>
        <div className="info-row">
          <span>Respondent:</span>
          <span className="address">{dispute.respondent}</span>
        </div>
        <div className="info-row">
          <span>Description:</span>
          <p>{dispute.description}</p>
        </div>
      </div>

      <div className="evidence-sections">
        <div className="evidence-section">
          <h2>Complainant Evidence</h2>
          <div className="evidence-list">
            {complainantEvidence.length > 0 ? (
              complainantEvidence.map((evidence: Evidence, index: number) => (
                <div key={index} className="evidence-item">
                  <p>{evidence.description}</p>
                  <a href={`https://ipfs.io/ipfs/${evidence.ipfsHash}`} target="_blank" rel="noopener noreferrer">
                    View Evidence
                  </a>
                  <span className="timestamp">
                    {new Date(evidence.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="no-evidence">No evidence submitted yet</div>
            )}
          </div>
        </div>

        <div className="evidence-section">
          <h2>Respondent Evidence</h2>
          <div className="evidence-list">
            {respondentEvidence.length > 0 ? (
              respondentEvidence.map((evidence: Evidence, index: number) => (
                <div key={index} className="evidence-item">
                  <p>{evidence.description}</p>
                  <a href={`https://ipfs.io/ipfs/${evidence.ipfsHash}`} target="_blank" rel="noopener noreferrer">
                    View Evidence
                  </a>
                  <span className="timestamp">
                    {new Date(evidence.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="no-evidence">No evidence submitted yet</div>
            )}
          </div>
        </div>
      </div>

      {canSubmitEvidence() && (
        <div className="submit-evidence">
          <h2>Submit New Evidence</h2>
          {submitError && <div className="error">{submitError}</div>}
          {submitSuccess && <div className="success">Evidence submitted successfully!</div>}
          <form onSubmit={handleSubmitEvidence}>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newEvidence.description}
                onChange={e => setNewEvidence({ ...newEvidence, description: e.target.value })}
                placeholder="Describe your evidence..."
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label>IPFS Hash</label>
              <input
                type="text"
                value={newEvidence.ipfsHash}
                onChange={e => setNewEvidence({ ...newEvidence, ipfsHash: e.target.value })}
                placeholder="Qm..."
                required
                disabled={submitting}
              />
              <small className="hint">Provide the IPFS hash of your uploaded evidence</small>
            </div>
            <button type="submit" disabled={submitting} className={submitting ? 'loading' : ''}>
              {submitting ? 'Submitting...' : 'Submit Evidence'}
            </button>
          </form>
        </div>
      )}

      {dispute.status === 1 && ( // Resolved
        <div className="resolution">
          <h2>Resolution</h2>
          <p>{dispute.resolution}</p>
          <div className="resolution-date">
            Resolved on: {new Date(dispute.resolvedAt * 1000).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeDetails;