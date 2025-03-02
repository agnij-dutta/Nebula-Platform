const hre = require("hardhat");
const config = require("../config/contracts.json");

async function main() {
  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with account:", signer.address);

  // Test IPToken
  const IPToken = await hre.ethers.getContractAt("IPToken", config.IPToken);
  console.log("IPToken address:", config.IPToken);
  const name = await IPToken.name();
  console.log("IPToken name:", name);

  // Test NEBLToken - only read operation
  const NEBLToken = await hre.ethers.getContractAt("NEBLToken", config.NEBLToken);
  console.log("NEBLToken address:", config.NEBLToken);
  const totalSupply = await NEBLToken.totalSupply();
  console.log("NEBL total supply:", totalSupply.toString());

  // Test IPMarketplace - read operation
  const IPMarketplace = await hre.ethers.getContractAt("IPMarketplace", config.IPMarketplace);
  console.log("IPMarketplace address:", config.IPMarketplace);
  const listing = await IPMarketplace.getListing(1);
  console.log("First listing seller:", listing.seller);

  // Test Governance - read operation
  const Governance = await hre.ethers.getContractAt("NebulaGovernor", config.Governance);
  console.log("Governance address:", config.Governance);
  try {
    const votingPeriod = await Governance.votingPeriod();
    console.log("Voting period:", votingPeriod.toString());
  } catch (error) {
    console.log("Could not fetch voting period:", error.message);
  }

  // Test ResearchProject - read operation
  const ResearchProject = await hre.ethers.getContractAt("ResearchProject", config.ResearchProject);
  console.log("ResearchProject address:", config.ResearchProject);
  try {
    const project = await ResearchProject.getProject(1);
    console.log("First project title:", project.title);
  } catch (error) {
    console.log("Could not fetch project:", error.message);
  }

  // Test Disputes - read operation
  const Disputes = await hre.ethers.getContractAt("Disputes", config.Disputes);
  console.log("Disputes address:", config.Disputes);
  try {
    const dispute = await Disputes.getDispute(1);
    console.log("First dispute complainant:", dispute.complainant);
  } catch (error) {
    console.log("Could not fetch dispute:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });