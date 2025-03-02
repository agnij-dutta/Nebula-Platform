require("dotenv").config();
const hre = require("hardhat");

async function main() {
  console.log("Deploying Nebula Platform contracts...");

  // Deploy IPToken first
  const IPToken = await hre.ethers.getContractFactory("IPToken");
  const ipToken = await IPToken.deploy();
  await ipToken.deployed();
  console.log("IPToken deployed to:", ipToken.address);

  // Deploy NEBL Token
  const NEBLToken = await hre.ethers.getContractFactory("NEBLToken");
  const neblToken = await NEBLToken.deploy();
  await neblToken.deployed();
  console.log("NEBLToken deployed to:", neblToken.address);

  // Deploy TimelockController for Governance
  const minDelay = 2 * 24 * 60 * 60; // 2 days
  const proposers = [];
  const executors = [];
  const [admin] = await hre.ethers.getSigners();
  const TimelockController = await hre.ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(minDelay, proposers, executors, admin.address);
  await timelock.deployed();
  console.log("TimelockController deployed to:", timelock.address);

  // Deploy Governance
  const votingDelay = 1; // 1 block
  const votingPeriod = 50400; // ~1 week (assuming 12s block time)
  const quorumPercentage = 4; // 4% quorum

  const Governance = await hre.ethers.getContractFactory("NebulaGovernor");
  const governance = await Governance.deploy(
    neblToken.address,
    timelock.address,
    votingDelay,
    votingPeriod,
    quorumPercentage
  );
  await governance.deployed();
  console.log("Governance deployed to:", governance.address);

  // Deploy Oracle (using admin as oracle for testing)
  const oracleAddress = admin.address;
  console.log("Using admin as oracle:", oracleAddress);

  // Chainlink AVAX/USD Price Feed address on testnet
  const priceFeedAddress = "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD";
  
  // First deploy ResearchProject with temporary addresses
  const ResearchProject = await hre.ethers.getContractFactory("ResearchProject");
  const TEMP_ADDRESS = "0x0000000000000000000000000000000000000000";
  const researchProject = await ResearchProject.deploy(TEMP_ADDRESS, oracleAddress);
  await researchProject.deployed();
  console.log("ResearchProject deployed to:", researchProject.address);

  // Now deploy FundingEscrow with actual addresses
  const FundingEscrow = await hre.ethers.getContractFactory("FundingEscrow");
  const fundingEscrow = await FundingEscrow.deploy(oracleAddress, priceFeedAddress, researchProject.address);
  await fundingEscrow.deployed();
  console.log("FundingEscrow deployed to:", fundingEscrow.address);

  // Now redeploy ResearchProject with actual FundingEscrow address
  const finalResearchProject = await ResearchProject.deploy(fundingEscrow.address, oracleAddress);
  await finalResearchProject.deployed();
  console.log("Final ResearchProject deployed to:", finalResearchProject.address);

  // Deploy Disputes contract
  const Disputes = await hre.ethers.getContractFactory("Disputes");
  const disputes = await Disputes.deploy(governance.address);
  await disputes.deployed();
  console.log("Disputes deployed to:", disputes.address);

  // Deploy IPMarketplace with IPToken address
  const [deployer] = await hre.ethers.getSigners();
  const IPMarketplace = await hre.ethers.getContractFactory("IPMarketplace");
  const platformWallet = await hre.ethers.getSigner();
  const ipMarketplace = await IPMarketplace.deploy(ipToken.address, platformWallet.address);
  await ipMarketplace.deployed();
  console.log("IPMarketplace deployed to:", ipMarketplace.address);

  // Configure roles for TimelockController
  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.TIMELOCK_ADMIN_ROLE();

  await timelock.grantRole(proposerRole, governance.address);
  await timelock.grantRole(executorRole, governance.address);
  // Optionally revoke admin role from deployer
  await timelock.revokeRole(adminRole, deployer.address);

  // Write deployed addresses to a file for frontend use
  const fs = require("fs");
  const deploymentInfo = {
    IPToken: ipToken.address,
    IPMarketplace: ipMarketplace.address,
    NEBLToken: neblToken.address,
    ResearchProject: finalResearchProject.address,
    FundingEscrow: fundingEscrow.address,
    Governance: governance.address,
    Disputes: disputes.address,
    chainId: hre.network.config.chainId
  };

  // Create config directory if it doesn't exist
  if (!fs.existsSync("./config")) {
    fs.mkdirSync("./config");
  }

  fs.writeFileSync(
    "./config/contracts.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Contract addresses saved to config/contracts.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });