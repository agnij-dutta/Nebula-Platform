import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useWeb3 } from './web3/hooks/useWeb3';
import { WEB3_CONFIG } from './web3/config';
import ListingsContainer from './components/ListingsContainer';
import CreateIP from './components/CreateIP';
import CreateListing from './components/CreateListing';
import ResearchHub from './components/ResearchHub';
import CreateResearchProject from './components/CreateResearchProject';
import ResearcherDashboard from './components/ResearcherDashboard';
import ProjectDetails from './components/ProjectDetails';
import Governance from './components/Governance';
import Staking from './components/Staking';
import WalletPrompt from './components/WalletPrompt';
import TokenSwap from './components/TokenSwap';
import ErrorDisplay from './components/ErrorDisplay';
import NetworkValidator from './components/NetworkValidator';
import { NetworkSwitchOverlay } from './components/NetworkSwitchOverlay';
import './App.css';
import './styles/theme.css';

function App() {
    const { 
        account, 
        error: web3Error, 
        connectWallet, 
        chainId, 
        switchToFujiTestnet, 
        needsWallet,
        isConnecting,
        isNetworkSwitching,
        disconnectWallet
    } = useWeb3();
    const [activeView, setActiveView] = useState<'browse' | 'create' | 'createIP' | 'research' | 'governance' | 'staking' | 'swap' | 'dashboard'>('browse');
    const [createdTokenId, setCreatedTokenId] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [showDisconnect, setShowDisconnect] = useState(false);
    
    const isWrongNetwork = chainId && chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId;

    const handleIPCreated = (tokenId: string) => {
        setCreatedTokenId(tokenId);
        setActiveView('create');
    };

    const handleListingCreated = () => {
        setCreatedTokenId(null);
        setActiveView('browse');
    };

    const handleNetworkError = useCallback(async () => {
        setIsRetrying(true);
        try {
            await switchToFujiTestnet();
            setGlobalError(null);
        } catch (err) {
            setGlobalError('Failed to switch network. Please try again or switch manually in MetaMask.');
        } finally {
            setIsRetrying(false);
        }
    }, [switchToFujiTestnet]);

    // Early return if wallet not connected or wrong network
    if (needsWallet || !account) {
        return (
            <Router>
                <div className="App wallet-not-connected">
                    <div className="stars-bg"></div>
                    <header className="App-header minimal">
                        <div className="header-content">
                            <div className="logo-container">
                                <h1>Nebula Platform</h1>
                            </div>
                        </div>
                    </header>
                    <main className="App-content">
                        <div className="card-3d">
                            <WalletPrompt 
                                message="Welcome to Nebula Platform! Connect your wallet to get started"
                                onConnect={() => connectWallet()}
                                isLoading={isConnecting}
                                isWrongNetwork={Boolean(isWrongNetwork)}
                                chainId={chainId?.toString(16)}
                                onSwitchNetwork={handleNetworkError}
                                isNetworkSwitching={isNetworkSwitching}
                            />
                        </div>
                    </main>
                </div>
            </Router>
        );
    }

    // Show network switch prompt if wrong network
    if (isWrongNetwork) {
        return (
            <Router>
                <div className="App network-switch-required">
                    <div className="stars-bg"></div>
                    <header className="App-header minimal">
                        <div className="header-content">
                            <div className="logo-container">
                                <h1>Nebula Platform</h1>
                            </div>
                            <div className="wallet-section">
                                <div className="account-info">
                                    <div className="wallet-status">
                                        <div className="wallet-indicator"></div>
                                        <span>Connected</span>
                                    </div>
                                    <span className="address">
                                        {`${account.slice(0, 6)}...${account.slice(-4)}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </header>
                    <main className="App-content">
                        <NetworkSwitchOverlay />
                    </main>
                </div>
            </Router>
        );
    }

    return (
        <Router>
            <NetworkValidator />
            <div className="space-theme space-scrollbar">
                <div className="stars-bg"></div>
                <div className="glass-effect">
                    <div className="App">
                        <header className="App-header">
                            <div className="header-content">
                                <div className="logo-container">
                                    <h1>Nebula Platform</h1>
                                </div>

                                <nav className="nav-links">
                                    <Link 
                                        to="/" 
                                        className={activeView === 'browse' ? 'active' : ''}
                                        onClick={() => setActiveView('browse')}
                                    >
                                        Browse IP
                                    </Link>
                                    <Link 
                                        to="/research" 
                                        className={activeView === 'research' ? 'active' : ''}
                                        onClick={() => setActiveView('research')}
                                    >
                                        The Hub
                                    </Link>
                                    <Link 
                                        to="/governance" 
                                        className={activeView === 'governance' ? 'active' : ''}
                                        onClick={() => setActiveView('governance')}
                                    >
                                        Governance
                                    </Link>
                                    <Link 
                                        to="/staking" 
                                        className={activeView === 'staking' ? 'active' : ''}
                                        onClick={() => setActiveView('staking')}
                                    >
                                        Stake
                                    </Link>
                                    <Link 
                                        to="/swap" 
                                        className={activeView === 'swap' ? 'active' : ''}
                                        onClick={() => setActiveView('swap')}
                                    >
                                        Swap
                                    </Link>
                                    {account && (
                                        <>
                                            <Link 
                                                to="/create-ip" 
                                                className={activeView === 'createIP' ? 'active' : ''}
                                                onClick={() => setActiveView('createIP')}
                                            >
                                                Create IP
                                            </Link>
                                            <Link 
                                                to="/dashboard" 
                                                className={activeView === 'dashboard' ? 'active' : ''}
                                                onClick={() => setActiveView('dashboard')}
                                            >
                                                Dashboard
                                            </Link>
                                        </>
                                    )}
                                </nav>
                                
                                <div className="wallet-section">
                                    {isWrongNetwork ? (
                                        <button 
                                            onClick={handleNetworkError} 
                                            className={`network-button error ${isNetworkSwitching || isRetrying ? 'switching' : ''}`}
                                            disabled={isNetworkSwitching || isRetrying}
                                        >
                                            {isNetworkSwitching || isRetrying ? (
                                                <>Switching Network<span className="loading-dots"></span></>
                                            ) : (
                                                `Switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`
                                            )}
                                        </button>
                                    ) : (
                                        <div 
                                            className="account-info"
                                            onMouseEnter={() => setShowDisconnect(true)}
                                            onMouseLeave={() => setShowDisconnect(false)}
                                            onClick={showDisconnect ? disconnectWallet : undefined}
                                        >
                                            <div className="wallet-status">
                                                <div className="wallet-indicator"></div>
                                                <span>{showDisconnect ? 'Disconnect' : 'Connected'}</span>
                                            </div>
                                            <span className="address">
                                                {`${account.slice(0, 6)}...${account.slice(-4)}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        {(web3Error || globalError) && (
                            <ErrorDisplay 
                                message={globalError || web3Error}
                                onRetry={isWrongNetwork ? handleNetworkError : undefined}
                                isRetrying={isRetrying || isNetworkSwitching}
                            />
                        )}
                        
                        <main className="main-content">
                            <Routes>
                                <Route
                                    path="/"
                                    element={<ListingsContainer />}
                                />
                                <Route 
                                    path="/create-listing"
                                    element={
                                        <CreateListing
                                            initialTokenId={createdTokenId}
                                            onListingCreated={handleListingCreated}
                                        />
                                    }
                                />
                                <Route
                                    path="/create-ip"
                                    element={<CreateIP onTokenCreated={handleIPCreated} />}
                                />
                                <Route
                                    path="/research"
                                    element={<ResearchHub />}
                                />
                                <Route
                                    path="/staking"
                                    element={<Staking />}
                                />
                                <Route
                                    path="/create-research"
                                    element={<CreateResearchProject />}
                                />
                                <Route
                                    path="/dashboard"
                                    element={<ResearcherDashboard />}
                                />
                                <Route
                                    path="/project/:id"
                                    element={<ProjectDetails />}
                                />
                                <Route
                                    path="/governance"
                                    element={<Governance />}
                                />
                                <Route
                                    path="/swap"
                                    element={<TokenSwap />}
                                />
                                <Route
                                    path="*"
                                    element={
                                        <div className="error card-3d">
                                            <h2>Page Not Found</h2>
                                            <p>The page you are looking for does not exist.</p>
                                            <Link to="/" className="interactive-button">
                                                Return Home
                                            </Link>
                                        </div>
                                    }
                                />
                            </Routes>
                        </main>
                    </div>
                </div>
            </div>
        </Router>
    );
}

export default App;
