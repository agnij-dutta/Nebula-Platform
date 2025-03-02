const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Adding liquidity from account:", deployer.address);

    const config = require("../config/contracts.json");
    const neblTokenAddress = config.NEBLToken;
    const neblSwapAddress = config.NEBLSwap;

    // Get NEBL Token contract
    const NEBLToken = await hre.ethers.getContractFactory("NEBLToken");
    const neblToken = await NEBLToken.attach(neblTokenAddress);

    // Transfer 1M NEBL tokens to the swap contract for initial liquidity
    const amount = hre.ethers.utils.parseEther("1000000");
    console.log("Transferring 1M NEBL tokens to swap contract...");
    
    const tx = await neblToken.transfer(neblSwapAddress, amount);
    await tx.wait();
    
    console.log("Liquidity added successfully");
    
    // Verify the balance
    const balance = await neblToken.balanceOf(neblSwapAddress);
    console.log("NEBLSwap contract balance:", hre.ethers.utils.formatEther(balance), "NEBL");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });