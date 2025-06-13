import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './web3/wagmi';
import { useWeb3Context } from './web3/providers/Web3Provider';
import WalletPrompt from './components/WalletPrompt';
import ListingsContainer from './components/ListingsContainer';
import CreateIP from './components/CreateIP';
import CreateListing from './components/CreateListing';
import ResearchHub from './components/ResearchHub';
import CreateResearchProject from './components/CreateResearchProject';
import ResearcherDashboard from './components/ResearcherDashboard';
import ProjectDetails from './components/ProjectDetails';
import Governance from './components/Governance';
import Staking from './components/Staking';
import TokenSwap from './components/TokenSwap';
import IPManagement from './pages/IPManagement';
import IPAssetDetails from './pages/IPAssetDetails';
import LicenseManagement from './pages/LicenseManagement';
import RoyaltyManagement from './pages/RoyaltyManagement';
import './App.css';
import './styles/theme.css';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './web3/providers/Web3Provider';

// Create a client with custom config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

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

// Enhanced Navigation Component
const Navbar = () => {
  const location = useLocation();
  const { account, chainId, disconnectWallet } = useWeb3Context();
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/marketplace', label: 'Marketplace', icon: '🛒' },
    { path: '/create-ip', label: 'Create IP', icon: '💡' },
    { path: '/research', label: 'Research', icon: '🔬' },
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/governance', label: 'Governance', icon: '🏛️' },
    { path: '/staking', label: 'Staking', icon: '💎' },
    { path: '/swap', label: 'Swap', icon: '🔄' },
  ];

  const moreItems = [
    { path: '/create-listing', label: 'Create Listing', icon: '📝' },
    { path: '/create-project', label: 'Create Project', icon: '🚀' },
    { path: '/ip-management', label: 'IP Management', icon: '⚖️' },
    { path: '/licenses', label: 'Licenses', icon: '📄' },
    { path: '/royalties', label: 'Royalties', icon: '💰' },
  ];

  return (
    <nav className="nebula-navbar">
      <div className="navbar-container">
        {/* Logo Section */}
        <Link to="/" className="navbar-brand">
          <NebulaLogo size={36} />
          <div className="brand-text">
            <span className="brand-name">Nebula</span>
            <span className="brand-subtitle">Platform</span>
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="navbar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </Link>
          ))}
          
          {/* More Dropdown */}
          <div className="nav-dropdown">
            <button className="nav-link dropdown-toggle">
              <span className="nav-icon">⋯</span>
              <span className="nav-text">More</span>
            </button>
            <div className="dropdown-menu">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`dropdown-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="navbar-wallet">
          <div className="wallet-info">
            <div className="network-info">
              <span className="network-indicator"></span>
              <span className="network-text">
                {chainId === 43113 ? 'Fuji' : chainId === 43114 ? 'Avalanche' : `Chain ${chainId}`}
              </span>
            </div>
            <div className="wallet-address">
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ''}
            </div>
          </div>
          <button onClick={disconnectWallet} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      </div>
    </nav>
  );
};

// Home Page Component
const HomePage = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1 className="hero-title">Welcome to Nebula Platform</h1>
        <p className="hero-description">
          Your gateway to the decentralized universe. Connect, create, and innovate 
          with cutting-edge blockchain technology.
        </p>
      </div>

      <div className="features-grid">
        <Link to="/marketplace" className="feature-card">
          <div className="feature-icon">🛒</div>
          <h3>Marketplace</h3>
          <p>Browse and trade intellectual property assets</p>
        </Link>

        <Link to="/create-ip" className="feature-card">
          <div className="feature-icon">💡</div>
          <h3>Create IP</h3>
          <p>Register and protect your intellectual property</p>
        </Link>

        <Link to="/research" className="feature-card">
          <div className="feature-icon">🔬</div>
          <h3>Research Hub</h3>
          <p>Collaborate on cutting-edge research projects</p>
        </Link>

        <Link to="/staking" className="feature-card">
          <div className="feature-icon">💎</div>
          <h3>Staking</h3>
          <p>Stake tokens and earn rewards</p>
        </Link>

        <Link to="/governance" className="feature-card">
          <div className="feature-icon">🏛️</div>
          <h3>Governance</h3>
          <p>Participate in platform governance</p>
        </Link>

        <Link to="/swap" className="feature-card">
          <div className="feature-icon">🔄</div>
          <h3>Token Swap</h3>
          <p>Exchange tokens seamlessly</p>
        </Link>
      </div>
    </div>
  );
};

function AppContent() {
  const { isConnected, isWrongNetwork } = useWeb3Context();

  // Show wallet prompt if not connected or on wrong network
  if (!isConnected || isWrongNetwork) {
    return <WalletPrompt />;
  }

        return (
    <Router>
    <div className="App">
      {/* Stars background */}
      <div className="stars-bg">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

        <Navbar />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/marketplace" element={<ListingsContainer />} />
            <Route path="/create-ip" element={<CreateIP onTokenCreated={(tokenId) => console.log('Token created:', tokenId)} />} />
            <Route path="/create-listing" element={<CreateListing onListingCreated={() => console.log('Listing created')} />} />
            <Route path="/research" element={<ResearchHub />} />
            <Route path="/create-research" element={<Navigate to="/create-project" replace />} />
            <Route path="/create-project" element={<CreateResearchProject />} />
            <Route path="/dashboard" element={<ResearcherDashboard />} />
            <Route path="/project/:id" element={<ProjectDetails />} />
            <Route path="/governance" element={<Governance />} />
            <Route path="/staking" element={<Staking />} />
            <Route path="/swap" element={<TokenSwap />} />
            <Route path="/ip-management" element={<IPManagement />} />
            <Route path="/ip-asset/:id" element={<IPAssetDetails />} />
            <Route path="/licenses" element={<LicenseManagement />} />
            <Route path="/royalties" element={<RoyaltyManagement />} />
          </Routes>
      </main>
                            </div>
    </Router>
  );
}

function App() {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <Web3Provider>
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                fontSize: '14px',
                fontFamily: "'Space Grotesk', sans-serif",
              },
            }}
          />
        </Web3Provider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default App;
