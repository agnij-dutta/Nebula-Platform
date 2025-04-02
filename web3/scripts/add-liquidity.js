const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("Adding liquidity to NEBLSwap contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using deployer account:", deployer.address);

  // Hardcoded contract addresses from frontend config
  const neblTokenAddress = "0x6bE799db96487ba39262e15e6D8b1b67aC8b4DA0";
  const neblSwapAddress = "0x512ade688582F8181047B202EdFacd9043632A03";

  console.log("NEBL Token address:", neblTokenAddress);
  console.log("NEBLSwap address:", neblSwapAddress);

  // Connect to contracts
  const NEBLToken = await hre.ethers.getContractFactory("NEBLToken");
  const neblToken = await NEBLToken.attach(neblTokenAddress);

  // Check deployer balance
  const deployerBalance = await neblToken.balanceOf(deployer.address);
  console.log("Deployer NEBL balance:", ethers.utils.formatEther(deployerBalance));

  // Check current swap contract balance
  const swapBalance = await neblToken.balanceOf(neblSwapAddress);
  console.log("Current NEBLSwap contract balance:", ethers.utils.formatEther(swapBalance));

  // Calculate amount to transfer (50% of total supply)
  const totalSupply = await neblToken.totalSupply();
  const amountToTransfer = totalSupply.div(2); // 50% of total supply
  console.log("Amount to transfer to swap contract:", ethers.utils.formatEther(amountToTransfer));

  // Transfer tokens to swap contract
  console.log("Transferring tokens to swap contract...");
  const tx = await neblToken.transfer(neblSwapAddress, amountToTransfer);
  console.log("Transaction hash:", tx.hash);
  
  // Wait for transaction to be mined
  await tx.wait();
  console.log("Transfer complete!");

  // Verify new balances
  const newDeployerBalance = await neblToken.balanceOf(deployer.address);
  const newSwapBalance = await neblToken.balanceOf(neblSwapAddress);
  
  console.log("New deployer NEBL balance:", ethers.utils.formatEther(newDeployerBalance));
  console.log("New NEBLSwap contract balance:", ethers.utils.formatEther(newSwapBalance));
  console.log("Liquidity successfully added to NEBLSwap contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
