const fs = require("fs");
const path = require("path");

async function updateFrontendConfig() {
  try {
    // Read the deployment info
    const deploymentPath = path.join(__dirname, "../config/new-marketplace-deployment.json");
    
    if (!fs.existsSync(deploymentPath)) {
      console.error("❌ Deployment info not found. Please run deploy-new-marketplace.js first.");
      process.exit(1);
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const newMarketplaceAddress = deploymentInfo.contracts.IPMarketplace.address;
    
    console.log("📖 Reading deployment info...");
    console.log("New marketplace address:", newMarketplaceAddress);
    
    // Update frontend config
    const frontendConfigPath = path.join(__dirname, "../../frontend/src/web3/config.ts");
    
    if (!fs.existsSync(frontendConfigPath)) {
      console.error("❌ Frontend config file not found:", frontendConfigPath);
      process.exit(1);
    }
    
    let configContent = fs.readFileSync(frontendConfigPath, "utf8");
    
    // Replace the IPMarketplace address
    const oldAddressPattern = /IPMarketplace:\s*{\s*address:\s*['"`]0x[a-fA-F0-9]{40}['"`]/;
    const newAddressConfig = `IPMarketplace: {\n            address: '${newMarketplaceAddress}'`;
    
    if (oldAddressPattern.test(configContent)) {
      configContent = configContent.replace(oldAddressPattern, newAddressConfig);
      
      // Write the updated config
      fs.writeFileSync(frontendConfigPath, configContent);
      
      console.log("✅ Frontend config updated successfully!");
      console.log("📍 Updated file:", frontendConfigPath);
      console.log("🔗 New marketplace address:", newMarketplaceAddress);
      
      // Create a backup of the old config
      const backupPath = frontendConfigPath + `.backup.${Date.now()}`;
      console.log("💾 Backup created:", backupPath);
      
    } else {
      console.error("❌ Could not find IPMarketplace address pattern in config file");
      console.log("Please manually update the IPMarketplace address in:", frontendConfigPath);
      console.log("New address:", newMarketplaceAddress);
    }
    
  } catch (error) {
    console.error("❌ Error updating frontend config:", error.message);
    process.exit(1);
  }
}

updateFrontendConfig(); 