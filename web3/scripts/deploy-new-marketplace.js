require("dotenv").config();
const hre = require("hardhat");

async function main() {
  console.log("Deploying new IPMarketplace contract with updated IPAsset address...");

  // The new IPAsset contract address (from the frontend config)
  const IP_ASSET_ADDRESS = "0x9da6BBe47BCD86E661Bbc542173C0b6B87A5A953";
  
  // Get the deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy IPMarketplace with the new IPAsset address
  const IPMarketplace = await hre.ethers.getContractFactory("IPMarketplace");
  const platformWallet = deployer.address; // Use deployer as platform wallet
  
  console.log("Deploying IPMarketplace with:");
  console.log("- IPAsset address:", IP_ASSET_ADDRESS);
  console.log("- Platform wallet:", platformWallet);
  
  const ipMarketplace = await IPMarketplace.deploy(IP_ASSET_ADDRESS, platformWallet);
  await ipMarketplace.deployed();
  
  console.log("✅ New IPMarketplace deployed to:", ipMarketplace.address);

  // Verify the configuration
  const configuredIPToken = await ipMarketplace.ipToken();
  const configuredPlatformWallet = await ipMarketplace.platformWallet();
  
  console.log("\n📋 Deployment Verification:");
  console.log("- Marketplace address:", ipMarketplace.address);
  console.log("- Configured IP Token:", configuredIPToken);
  console.log("- Platform wallet:", configuredPlatformWallet);
  console.log("- Matches IPAsset?", configuredIPToken.toLowerCase() === IP_ASSET_ADDRESS.toLowerCase());

  // Write the new contract address to a file
  const fs = require("fs");
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    contracts: {
      IPMarketplace: {
        address: ipMarketplace.address,
        configuredIPToken: configuredIPToken,
        platformWallet: configuredPlatformWallet
      }
    },
    oldMarketplace: "0x554157ab69F167A2946FFd74d5263c216A723dc1",
    transactionHash: ipMarketplace.deployTransaction.hash
  };

  // Create config directory if it doesn't exist
  if (!fs.existsSync("./config")) {
    fs.mkdirSync("./config");
  }

  fs.writeFileSync(
    "./config/new-marketplace-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to config/new-marketplace-deployment.json");
  console.log("\n🔧 Next steps:");
  console.log("1. Update frontend/src/web3/config.ts with the new marketplace address:");
  console.log(`   IPMarketplace: { address: '${ipMarketplace.address}' }`);
  console.log("2. Test the marketplace functionality");
  console.log("3. Update any other systems that reference the old marketplace");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 