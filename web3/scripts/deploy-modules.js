const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Nebula Platform modular contracts...");

  // Get the contract factories
  const Registry = await ethers.getContractFactory("Registry");
  const IPAsset = await ethers.getContractFactory("IPAsset");
  const LicenseModule = await ethers.getContractFactory("LicenseModule");
  const RoyaltyModule = await ethers.getContractFactory("RoyaltyModule");

  // Deploy Registry
  console.log("Deploying Registry...");
  const registry = await Registry.deploy();
  await registry.deployed();
  console.log("Registry deployed to:", registry.address);

  // Deploy IPAsset
  console.log("Deploying IPAsset...");
  const ipAsset = await IPAsset.deploy();
  await ipAsset.deployed();
  console.log("IPAsset deployed to:", ipAsset.address);

  // Deploy LicenseModule
  console.log("Deploying LicenseModule...");
  const licenseModule = await LicenseModule.deploy();
  await licenseModule.deployed();
  console.log("LicenseModule deployed to:", licenseModule.address);

  // Deploy RoyaltyModule
  console.log("Deploying RoyaltyModule...");
  const royaltyModule = await RoyaltyModule.deploy();
  await royaltyModule.deployed();
  console.log("RoyaltyModule deployed to:", royaltyModule.address);

  // Initialize modules
  console.log("Initializing modules...");
  await ipAsset.initialize(registry.address);
  await licenseModule.initialize(registry.address);
  await royaltyModule.initialize(registry.address);

  // Register modules in Registry
  console.log("Registering modules in Registry...");
  const IP_ASSET_MODULE_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IP_ASSET"));
  const LICENSE_MODULE_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LICENSE_MODULE"));
  const ROYALTY_MODULE_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROYALTY_MODULE"));

  await registry.registerModule(IP_ASSET_MODULE_TYPE, ipAsset.address);
  await registry.registerModule(LICENSE_MODULE_TYPE, licenseModule.address);
  await registry.registerModule(ROYALTY_MODULE_TYPE, royaltyModule.address);

  console.log("All modules registered successfully!");

  // Log deployment addresses for frontend configuration
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log(`Registry: ${registry.address}`);
  console.log(`IPAsset: ${ipAsset.address}`);
  console.log(`LicenseModule: ${licenseModule.address}`);
  console.log(`RoyaltyModule: ${royaltyModule.address}`);
  console.log("\nUpdate your frontend configuration with these addresses.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
