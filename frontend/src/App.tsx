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
                    <header className="App-header minimal">
                        <div className="header-content">
                            <div className="logo">Nebula Platform</div>
                        </div>
                    </header>
                    <main className="App-content">
                        <WalletPrompt 
                            message="Welcome to Nebula Platform! Connect your wallet to get started"
                            onConnect={connectWallet}
                            isLoading={isConnecting}
                        />
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
                    <header className="App-header minimal">
                        <div className="header-content">
                            <div className="logo">Nebula Platform</div>
                            <div className="wallet-section">
                                <div className="wallet-controls">
                                    <div
                                        className={`address-container ${showDisconnect ? 'hover' : ''}`}
                                        onMouseEnter={() => setShowDisconnect(true)}
                                        onMouseLeave={() => setShowDisconnect(false)}
                                    >
                                        <span className="address">
                                            {showDisconnect ? 'Disconnect' : `${account.slice(0, 6)}...${account.slice(-4)}`}
                                        </span>
                                        {showDisconnect && (
                                            <button onClick={disconnectWallet} className="disconnect-button">
                                                Disconnect
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>
                    <main className="App-content">
                        <WalletPrompt 
                            message={`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name} to continue`}
                            onConnect={switchToFujiTestnet}
                            isNetworkSwitching={isNetworkSwitching || isRetrying}
                            isLoading={isNetworkSwitching || isRetrying}
                        />
                    </main>
                </div>
            </Router>
        );
    }

    return (
        <Router>
            <NetworkValidator />
            <div className="space-theme space-scrollbar">
                <div className="glass-effect">
                    <div className="App">
                        <header className="App-header">
                            <div className="header-content">
                                <nav className="nav-links">
                                    <Link to="/" className={activeView === 'browse' ? 'active' : ''}>
                                        Browse IP
                                    </Link>
                                    <Link to="/research" className={activeView === 'research' ? 'active' : ''}>
                                        The Hub
                                    </Link>
                                    <Link to="/governance" className={activeView === 'governance' ? 'active' : ''}>
                                        Governance
                                    </Link>
                                    <Link to="/staking" className={activeView === 'staking' ? 'active' : ''}>
                                        Stake
                                    </Link>
                                    <Link to="/swap" className={activeView === 'swap' ? 'active' : ''}>
                                        Swap
                                    </Link>
                                    {account && (
                                        <>
                                            <Link to="/create-ip" className={activeView === 'createIP' ? 'active' : ''}>
                                                Create IP
                                            </Link>
                                            <Link to="/dashboard" className={activeView === 'dashboard' ? 'active' : ''}>
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
                                        <div className="wallet-controls">
                                            <div
                                                className={`address-container ${showDisconnect ? 'hover' : ''}`}
                                                onMouseEnter={() => setShowDisconnect(true)}
                                                onMouseLeave={() => setShowDisconnect(false)}
                                            >
                                                <span className="address">
                                                    {showDisconnect ? 'Disconnect' : `${account.slice(0, 6)}...${account.slice(-4)}`}
                                                </span>
                                                {showDisconnect && (
                                                    <button onClick={disconnectWallet} className="disconnect-button">
                                                        Disconnect
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        {(web3Error || globalError) && (
                            <ErrorDisplay 
                                message={globalError || web3Error}
                                onRetry={isWrongNetwork ? handleNetworkError : undefined}
                            />
                        )}

                        <main className="App-content">
                            {isWrongNetwork ? (
                                <WalletPrompt 
                                    message={`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name} to continue`}
                                    onConnect={handleNetworkError}
                                    isNetworkSwitching={isNetworkSwitching || isRetrying}
                                    isLoading={isNetworkSwitching || isRetrying}
                                />
                            ) : (
                                <Routes>
                                    <Route path="/" element={<ListingsContainer />} />
                                    <Route path="/create-ip" element={<CreateIP onIPCreated={handleIPCreated} />} />
                                    <Route 
                                        path="/create-listing" 
                                        element={
                                            <CreateListing 
                                                initialTokenId={createdTokenId} 
                                                onListingCreated={handleListingCreated} 
                                            />
                                        } 
                                    />
                                    <Route path="/research" element={<ResearchHub />} />
                                    <Route path="/create-research" element={<CreateResearchProject />} />
                                    <Route path="/dashboard" element={<ResearcherDashboard />} />
                                    <Route path="/project/:id" element={<ProjectDetails />} />
                                    <Route path="/governance" element={<Governance />} />
                                    <Route path="/staking" element={<Staking />} />
                                    <Route path="/swap" element={<TokenSwap />} />
                                </Routes>
                            )}
                        </main>
                    </div>
                </div>
            </div>
        </Router>
    );
}

export default App;
