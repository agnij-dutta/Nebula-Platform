// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Registry
 * @dev Central registry for all Nebula Platform modules
 * Allows for module discovery and upgradability
 */
contract Registry is Ownable {
    // Mapping from module name (as bytes32) to module address
    mapping(bytes32 => address) private _modules;
    
    // Events
    event ModuleRegistered(bytes32 indexed name, address indexed moduleAddress);
    event ModuleUpdated(bytes32 indexed name, address indexed oldAddress, address indexed newAddress);
    
    /**
     * @dev Register a new module
     * @param name The name of the module (as bytes32)
     * @param moduleAddress The address of the module contract
     */
    function registerModule(bytes32 name, address moduleAddress) external onlyOwner {
        require(moduleAddress != address(0), "Registry: Invalid module address");
        require(_modules[name] == address(0), "Registry: Module already registered");
        
        _modules[name] = moduleAddress;
        emit ModuleRegistered(name, moduleAddress);
    }
    
    /**
     * @dev Update an existing module
     * @param name The name of the module (as bytes32)
     * @param newAddress The new address of the module contract
     */
    function updateModule(bytes32 name, address newAddress) external onlyOwner {
        require(newAddress != address(0), "Registry: Invalid module address");
        require(_modules[name] != address(0), "Registry: Module not registered");
        
        address oldAddress = _modules[name];
        _modules[name] = newAddress;
        emit ModuleUpdated(name, oldAddress, newAddress);
    }
    
    /**
     * @dev Get a module address by name
     * @param name The name of the module (as bytes32)
     * @return The address of the module
     */
    function getModule(bytes32 name) external view returns (address) {
        return _modules[name];
    }
    
    /**
     * @dev Check if a module is registered
     * @param name The name of the module (as bytes32)
     * @return True if the module is registered, false otherwise
     */
    function isModuleRegistered(bytes32 name) external view returns (bool) {
        return _modules[name] != address(0);
    }
}
