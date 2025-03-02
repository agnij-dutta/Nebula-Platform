const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy FundingEscrow
    const FundingEscrow = await ethers.getContractFactory("FundingEscrow");
    const priceFeedAddress = "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD"; // Fuji AVAX/USD price feed
    const researchProjectAddress = "0x52839d3ccDbE1d924B5F75883356A3727D475FbC"; // Already deployed ResearchProject
    
    const fundingEscrow = await FundingEscrow.deploy(
        deployer.address, // oracle address (temporary)
        priceFeedAddress,
        researchProjectAddress,
        { gasLimit: 3000000 } // Optimized gas limit
    );
    await fundingEscrow.deployed();
    console.log("FundingEscrow deployed to:", fundingEscrow.address);

    // Deploy MilestoneOracle
    const MilestoneOracle = await ethers.getContractFactory("MilestoneOracle");
    const chainlinkTokenAddress = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846"; // Fuji LINK token
    
    const milestoneOracle = await MilestoneOracle.deploy(
        chainlinkTokenAddress,
        researchProjectAddress,
        deployer.address, // operator address
        { gasLimit: 4000000 } // Optimized gas limit
    );
    await milestoneOracle.deployed();
    console.log("MilestoneOracle deployed to:", milestoneOracle.address);

    // Update the FundingEscrow with the actual oracle address
    await fundingEscrow.setOracle(milestoneOracle.address, { gasLimit: 100000 });
    console.log("FundingEscrow oracle updated");

    // Verify contracts on Snowtrace (optional)
    if (process.env.SNOWTRACE_API_KEY) {
        console.log("Verifying contracts on Snowtrace...");
        
        await hre.run("verify:verify", {
            address: fundingEscrow.address,
            constructorArguments: [
                deployer.address,
                priceFeedAddress,
                researchProjectAddress
            ],
        });

        await hre.run("verify:verify", {
            address: milestoneOracle.address,
            constructorArguments: [
                chainlinkTokenAddress,
                researchProjectAddress,
                deployer.address
            ],
        });
    }
}