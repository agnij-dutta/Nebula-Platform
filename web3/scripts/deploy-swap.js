const hre = require("hardhat");

async function main() {
    console.log("Deploying NEBLSwap contract...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Get previously deployed contracts' addresses
    const config = require("../config/contracts.json");
    const neblTokenAddress = config.NEBLToken;
    const priceFeedAddress = "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD"; // Fuji AVAX/USD price feed

    // Deploy NEBLSwap
    const NEBLSwap = await hre.ethers.getContractFactory("NEBLSwap");
    const neblSwap = await NEBLSwap.deploy(
        neblTokenAddress,
        priceFeedAddress,
        { gasLimit: 3000000 }
    );
    await neblSwap.deployed();
    console.log("NEBLSwap deployed to:", neblSwap.address);

    // Update the contract addresses
    const fs = require("fs");
    config.NEBLSwap = neblSwap.address;
    
    fs.writeFileSync(
        "./config/contracts.json",
        JSON.stringify(config, null, 2)
    );
    console.log("Contract address saved to config/contracts.json");

    // Verify contract on Snowtrace
    if (process.env.SNOWTRACE_API_KEY) {
        console.log("Verifying contract on Snowtrace...");
        await hre.run("verify:verify", {
            address: neblSwap.address,
            constructorArguments: [
                neblTokenAddress,
                priceFeedAddress
            ],
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });