// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./interfaces/IModule.sol";
import "./Registry.sol";

/**
 * @title ModuleBase
 * @dev Base contract for all Nebula Platform modules
 */
abstract contract ModuleBase is IModule {
    // The registry contract
    Registry public registry;
    
    // Initialization state
    bool private _initialized;
    
    // Modifier to check if the module is initialized
    modifier onlyInitialized() {
        require(_initialized, "ModuleBase: Module not initialized");
        _;
    }
    
    /**
     * @dev Initialize the module with the registry address
     * @param registryAddress The address of the registry contract
     */
    function initialize(address registryAddress) external override {
        require(!_initialized, "ModuleBase: Already initialized");
        require(registryAddress != address(0), "ModuleBase: Invalid registry address");
        
        registry = Registry(registryAddress);
        _initialized = true;
    }
    
    /**
     * @dev Get a module from the registry
     * @param moduleType The type of the module to get
     * @return The address of the module
     */
    function getModuleAddress(bytes32 moduleType) internal view onlyInitialized returns (address) {
        address moduleAddress = registry.getModule(moduleType);
        require(moduleAddress != address(0), "ModuleBase: Module not registered");
        return moduleAddress;
    }
}
