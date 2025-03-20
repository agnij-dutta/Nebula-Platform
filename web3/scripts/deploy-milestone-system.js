const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Fuji testnet addresses
const CHAINLINK_TOKEN = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
const CHAINLINK_AVAX_USD_FEED = "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD";

async function verifyContract(address, constructorArguments) {
    console.log('Verifying contract at', address);
    try {
        await hre.run('verify:verify', {
            address: address,
            constructorArguments: constructorArguments
        });
    } catch (e) {
        if (e.message.toLowerCase().includes('already verified')) {
            console.log('Already verified!');
        } else {
            console.error(e);
        }
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy FundingEscrow first with temporary oracle address
    console.log("Deploying FundingEscrow...");
    const FundingEscrow = await ethers.getContractFactory("FundingEscrow");
    const fundingEscrow = await FundingEscrow.deploy(
        deployer.address, // temporary oracle address
        CHAINLINK_AVAX_USD_FEED,
        deployer.address // temporary research project address
    );
    await fundingEscrow.deployed();
    console.log("FundingEscrow deployed to:", fundingEscrow.address);

    // Deploy ResearchProject
    console.log("Deploying ResearchProject...");
    const ResearchProject = await ethers.getContractFactory("ResearchProject");
    const researchProject = await ResearchProject.deploy(
        fundingEscrow.address,
        deployer.address // temporary oracle address
    );
    await researchProject.deployed();
    console.log("ResearchProject deployed to:", researchProject.address);

    // Deploy MilestoneOracle with correct addresses
    console.log("Deploying MilestoneOracle...");
    const MilestoneOracle = await ethers.getContractFactory("MilestoneOracle");
    const milestoneOracle = await MilestoneOracle.deploy(
        CHAINLINK_TOKEN,
        researchProject.address,
        deployer.address // operator address (admin)
    );
    await milestoneOracle.deployed();
    console.log("MilestoneOracle deployed to:", milestoneOracle.address);

    // Wait for some block confirmations
    console.log("Waiting for block confirmations...");
    await fundingEscrow.deployTransaction.wait(5);
    await researchProject.deployTransaction.wait(5);
    await milestoneOracle.deployTransaction.wait(5);

    // Update contracts with correct addresses
    console.log("Setting up contract relationships...");
    await fundingEscrow.setResearchProjectContract(researchProject.address);
    await researchProject.setMilestoneOracle(milestoneOracle.address);

    // Verify contracts on Snowtrace if we're on testnet or mainnet
    if (network.name === "fuji" || network.name === "mainnet") {
        console.log("Verifying contracts on Snowtrace...");
        await verifyContract(fundingEscrow.address, [
            deployer.address,
            CHAINLINK_AVAX_USD_FEED,
            researchProject.address
        ]);
        await verifyContract(researchProject.address, [
            fundingEscrow.address,
            milestoneOracle.address
        ]);
        await verifyContract(milestoneOracle.address, [
            CHAINLINK_TOKEN,
            researchProject.address,
            deployer.address
        ]);
    }

    // Update config files
    const configPath = path.join(__dirname, '../config/contracts.json');
    const config = {
        ResearchProject: researchProject.address,
        FundingEscrow: fundingEscrow.address,
        MilestoneOracle: milestoneOracle.address,
        network: hre.network.name,
        chainId: hre.network.config.chainId
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Contract addresses saved to config");

    // Update frontend config
    const frontendConfigPath = path.join(__dirname, '../../frontend/src/web3/config.ts');
    const frontendConfig = `
export const CONTRACT_ADDRESSES = {
    ResearchProject: "${researchProject.address}",
    FundingEscrow: "${fundingEscrow.address}",
    MilestoneOracle: "${milestoneOracle.address}"
} as const;

export const NETWORK_CONFIG = {
    name: "${hre.network.name}",
    chainId: ${hre.network.config.chainId},
    rpcUrl: "${process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'}"
} as const;
`;

    fs.writeFileSync(frontendConfigPath, frontendConfig);
    console.log("Contract addresses copied to frontend config");

    console.log("Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });