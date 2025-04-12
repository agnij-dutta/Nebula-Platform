import React from "react";
import "./WalletPrompt.css";

interface WalletPromptProps {
  message: string;
  onConnect: () => void;
  isLoading?: boolean;
  isWrongNetwork?: boolean;
  chainId?: string | null;
  onSwitchNetwork?: () => void;
  isNetworkSwitching?: boolean;
}

const WalletPrompt: React.FC<WalletPromptProps> = ({
  message,
  onConnect,
  isLoading = false,
  isWrongNetwork = false,
  chainId = null,
  onSwitchNetwork,
  isNetworkSwitching = false,
}) => {
  const renderContent = () => {
    if (isWrongNetwork && onSwitchNetwork) {
      return (
        <>
          <div className="network-card">
            <div className="network-header">
              <div className="network-indicator" style={{ background: 'var(--error)' }}></div>
              <div className="network-title">Wrong Network</div>
            </div>
            <div className="network-content">
              <div className="network-name">Please Switch to Avalanche Fuji</div>
              <div className="network-details">
                <div className="network-detail">
                  <span className="detail-label">Current</span>
                  <span className="detail-value">{chainId || 'Unknown'}</span>
                </div>
                <div className="network-detail">
                  <span className="detail-label">Required</span>
                  <span className="detail-value">0xA869</span>
                </div>
              </div>
              <button
                className={`connect-button ${isNetworkSwitching ? "loading" : ""}`}
                onClick={onSwitchNetwork}
                disabled={isNetworkSwitching}
              >
                <span className="button-text">Switch to Avalanche Fuji</span>
                <div className="button-glow"></div>
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="welcome-message">
          <h3 className="welcome-title">Connect Your Wallet</h3>
          <p className="welcome-subtitle">
            {message}
          </p>
        </div>

        <div className="wallet-icon-wrapper">
          <img src="/metamask.svg" alt="MetaMask" className="wallet-icon" />
        </div>

        <div className="connect-button-container">
          <button
            className={`connect-button ${isLoading ? "loading" : ""}`}
            onClick={onConnect}
            disabled={isLoading}
          >
            <span className="button-text">
              {isLoading ? "Connecting..." : "Connect MetaMask"}
            </span>
            <div className="button-glow"></div>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="wallet-prompt">
      <div className="nebula-particles">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
        <div className="particle p5"></div>
        <div className="particle p6"></div>
      </div>

      <div className="wallet-prompt-content">
        <div className="nebula-logo-container">
          <div className="nebula-logo">N</div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default WalletPrompt;