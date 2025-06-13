import React, { useState, useEffect } from 'react';
import { useWeb3Context } from '../web3/providers/Web3Provider';
import './WalletPrompt.css';

// Props interface for WalletPrompt
interface WalletPromptProps {
  message?: string;
  onConnect?: () => Promise<void>;
  isLoading?: boolean;
}

// Animated Nebula Logo Component
const NebulaLogo: React.FC<{ size?: number; animate?: boolean }> = ({ 
  size = 40, 
  animate = true 
}) => (
  <div className={`nebula-logo ${animate ? 'animate' : ''}`} style={{ width: size, height: size }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="none"
        stroke="url(#gradient1)"
        strokeWidth="2"
        className="outer-ring"
      />
      <circle
        cx="20"
        cy="20"
        r="12"
        fill="none"
        stroke="url(#gradient2)"
        strokeWidth="1.5"
        className="middle-ring"
      />
      <circle
        cx="20"
        cy="20"
        r="6"
        fill="url(#gradient3)"
        className="inner-core"
      />
      <circle
        cx="15"
        cy="15"
        r="1.5"
        fill="#8B5CF6"
        className="dot dot-1"
      />
      <circle
        cx="26"
        cy="18"
        r="1"
        fill="#06B6D4"
        className="dot dot-2"
      />
      <circle
        cx="18"
        cy="28"
        r="1.2"
        fill="#10B981"
        className="dot dot-3"
      />
      
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <radialGradient id="gradient3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
        </radialGradient>
      </defs>
    </svg>
  </div>
);

// MetaMask Icon Component
const MetaMaskIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 1.63L13.5 8.45l1.67-3.94 7.39-2.88z"
      fill="#E17726"
      stroke="#E17726"
      strokeWidth="0.01"
    />
    <path
      d="M1.44 1.63l8.96 6.89-1.58-4.02L1.44 1.63zM19.24 17.05l-2.4 3.68 5.13 1.41 1.47-4.97-4.2-.12zM.75 17.17l1.46 4.97 5.13-1.41-2.4-3.68L.75 17.17z"
      fill="#E27625"
    />
    <path
      d="M6.85 10.48L5.55 12.3l5.08.23-.17-5.48-3.61 3.43zM17.15 10.48l-3.69-3.51-.11 5.56 5.08-.23-1.28-1.82zM6.94 20.73l3.07-1.5-2.65-2.07-.42 3.57zM14.99 19.23l3.07 1.5-.42-3.57-2.65 2.07z"
      fill="#E27625"
    />
    <path
      d="M18.06 20.73l-3.07-1.5.25 2.02-.03.86 2.85-1.38zM6.94 20.73l2.85 1.38-.02-.86.24-2.02-3.07 1.5z"
      fill="#D5BFB2"
    />
    <path
      d="M9.86 15.26l-2.54-.75 1.8-1.05.74 1.8zM14.14 15.26l.74-1.8 1.81 1.05-2.55.75z"
      fill="#233447"
    />
    <path
      d="M6.94 20.73l.43-3.68-2.83.08 2.4 3.6zM17.63 17.05l.43 3.68 2.4-3.6-2.83-.08zM18.43 12.3l-5.08.23.47 2.73.74-1.8 1.81 1.05 2.06-2.21zM7.32 14.51l1.8-1.05.74 1.8.47-2.73-5.08-.23 2.07 2.21z"
      fill="#CC6228"
    />
  </svg>
);

const WalletPrompt: React.FC<WalletPromptProps> = ({ 
  message = "Connect your wallet to continue",
  onConnect,
  isLoading = false
}) => {
  const {
    isConnected,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    isWrongNetwork,
    switchToFujiTestnet,
    isNetworkSwitching,
    account
  } = useWeb3Context();

  const [hasMetaMask, setHasMetaMask] = useState(false);

  // Use the provided onConnect function or fall back to the context's connectWallet
  const handleConnect = onConnect || connectWallet;
  
  // Use the provided isLoading or the context's isConnecting
  const isConnectingWallet = isLoading || isConnecting;

  useEffect(() => {
    setHasMetaMask(!!window.ethereum);
  }, []);

  if (isConnected && !isWrongNetwork) {
    return (
      <div className="wallet-prompt connected-state">
        <div className="connected-card glass-effect">
          <div className="connected-header">
            <NebulaLogo size={32} />
            <div className="connected-info">
              <h3>Wallet Connected</h3>
              <p className="wallet-address">
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={disconnectWallet}
            className="disconnect-btn"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="wallet-prompt">
        <div className="stars-bg">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>
        
        <div className="wallet-card glass-effect">
          <div className="wallet-header">
            <NebulaLogo size={48} />
            <h2>Wrong Network</h2>
            <p>Please switch to Avalanche Fuji Testnet to continue</p>
          </div>

          <div className="network-info">
            <div className="network-details">
              <span className="network-name">Avalanche Fuji Testnet</span>
              <span className="network-id">Chain ID: 43113</span>
            </div>
          </div>

          <button
            onClick={switchToFujiTestnet}
            disabled={isNetworkSwitching}
            className="connect-btn primary"
          >
            {isNetworkSwitching ? (
              <>
                <div className="spinner"></div>
                Switching Network...
              </>
            ) : (
              'Switch to Fuji Testnet'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-prompt">
      <div className="stars-bg">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>
      
      <div className="floating-particles">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>

      <div className="wallet-card glass-effect">
        <div className="wallet-header">
          <NebulaLogo size={56} />
          <h2>Connect Your Wallet</h2>
          <p>{message}</p>
        </div>

        {!hasMetaMask && (
          <div className="wallet-warning">
            <div className="warning-icon">⚠️</div>
            <div>
              <h4>MetaMask Not Detected</h4>
              <p>Please install MetaMask to use this application</p>
              <a 
                href="https://metamask.io/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="install-link"
              >
                Install MetaMask →
              </a>
            </div>
          </div>
        )}

        {hasMetaMask && (
          <div className="wallet-option">
            <div className="wallet-info">
              <MetaMaskIcon size={32} />
              <div>
                <h4>MetaMask</h4>
                <p>Connect using your MetaMask wallet</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">❌</span>
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={!hasMetaMask || isConnectingWallet}
          className={`connect-btn ${hasMetaMask ? 'primary' : 'disabled'}`}
        >
          {isConnectingWallet ? (
            <>
              <div className="spinner"></div>
              Connecting...
            </>
          ) : hasMetaMask ? (
            'Connect Wallet'
          ) : (
            'Install MetaMask First'
          )}
        </button>

        <div className="wallet-footer">
          <p>
            By connecting your wallet, you agree to our terms of service
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletPrompt;
