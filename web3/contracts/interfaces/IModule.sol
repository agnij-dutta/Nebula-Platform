// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title IModule
 * @dev Interface for all Nebula Platform modules
 */
interface IModule {
    /**
     * @dev Initialize the module with the registry address
     * @param registry The address of the registry contract
     */
    function initialize(address registry) external;
    
    /**
     * @dev Get the module type
     * @return The module type as bytes32
     */
    function getModuleType() external pure returns (bytes32);
}
