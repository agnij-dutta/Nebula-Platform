// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IResearchProject {
    function verifyAndReleaseFunds(uint256 projectId, uint256 milestoneId, string calldata proofCID) external;
}

contract MilestoneOracle is ChainlinkClient, AccessControl, ReentrancyGuard {
    using Chainlink for Chainlink.Request;
    using Strings for uint256;

    // Packed struct to save gas
    struct VerificationRequest {
        uint64 projectId;
        uint64 milestoneId;
        uint32 timestamp;
        uint8 attempts;
        bool isProcessing;
        bool isVerified;
        string proofCID;
    }

    bytes32 private constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint256 private constant VERIFICATION_FEE = 0.01 ether;
    IResearchProject private immutable researchProject;
    
    // Storage optimizations
    mapping(bytes32 => VerificationRequest) private verificationRequests;
    mapping(uint256 => mapping(uint256 => bytes32)) private latestRequestIds;

    event VerificationRequested(bytes32 indexed requestId, uint256 indexed projectId, uint256 indexed milestoneId, string proofCID);
    event VerificationCompleted(bytes32 indexed requestId, uint256 indexed projectId, uint256 indexed milestoneId, bool success);

    constructor(address _chainlinkToken, address _researchProject, address _operator) {
        setChainlinkToken(_chainlinkToken);
        researchProject = IResearchProject(_researchProject);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, _operator);
    }

    function requestVerification(
        uint256 projectId,
        uint256 milestoneId,
        string calldata proofCID,
        string calldata verificationCID,
        address _oracle,
        string calldata _jobId
    ) external payable nonReentrant {
        if(msg.value < VERIFICATION_FEE) revert("Fee too low");
        if(projectId > type(uint64).max) revert("Project ID too large");
        if(milestoneId > type(uint64).max) revert("Milestone ID too large");

        bytes32 lastRequestId = latestRequestIds[projectId][milestoneId];
        if (lastRequestId != bytes32(0) && verificationRequests[lastRequestId].isProcessing) {
            revert("Verification in progress");
        }

        Chainlink.Request memory req = buildChainlinkRequest(
            stringToBytes32(_jobId),
            address(this),
            this.fulfillVerification.selector
        );
        req.add("proofCID", proofCID);
        req.add("verificationCID", verificationCID);
        bytes32 requestId = sendChainlinkRequestTo(_oracle, req, 0);
        
        verificationRequests[requestId] = VerificationRequest({
            projectId: uint64(projectId),
            milestoneId: uint64(milestoneId),
            timestamp: uint32(block.timestamp),
            attempts: 1,
            isProcessing: true,
            isVerified: false,
            proofCID: proofCID
        });
        latestRequestIds[projectId][milestoneId] = requestId;
        
        emit VerificationRequested(requestId, projectId, milestoneId, proofCID);
    }

    function fulfillVerification(bytes32 _requestId, bool _verified) 
        external 
        recordChainlinkFulfillment(_requestId) 
    {
        VerificationRequest storage request = verificationRequests[_requestId];
        if(!request.isProcessing) revert("Invalid request");
        
        request.isProcessing = false;
        request.isVerified = _verified;
        
        if (_verified) {
            researchProject.verifyAndReleaseFunds(
                request.projectId,
                request.milestoneId,
                request.proofCID
            );
        }
        
        emit VerificationCompleted(
            _requestId,
            request.projectId,
            request.milestoneId,
            _verified
        );
    }

    // Optimized view functions
    function getLatestVerification(uint256 projectId, uint256 milestoneId)
        external
        view
        returns (
            bool isProcessing,
            bool isVerified,
            uint8 attempts,
            string memory proofCID,
            uint256 timestamp
        )
    {
        bytes32 requestId = latestRequestIds[projectId][milestoneId];
        if (requestId == bytes32(0)) return (false, false, 0, "", 0);
        
        VerificationRequest storage request = verificationRequests[requestId];
        return (
            request.isProcessing,
            request.isVerified,
            request.attempts,
            request.proofCID,
            request.timestamp
        );
    }

    // Admin functions
    function manualVerification(
        uint256 projectId,
        uint256 milestoneId,
        string calldata proofCID,
        bool verified
    ) external onlyRole(OPERATOR_ROLE) {
        if (verified) {
            researchProject.verifyAndReleaseFunds(projectId, milestoneId, proofCID);
        }
        emit VerificationCompleted(bytes32(0), projectId, milestoneId, verified);
    }

    function withdrawLink() external onlyRole(DEFAULT_ADMIN_ROLE) {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))));
    }

    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if(balance == 0) revert("No fees");
        (bool success, ) = msg.sender.call{value: balance}("");
        if(!success) revert("Transfer failed");
    }

    function stringToBytes32(string memory source) private pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) return 0x0;
        assembly {
            result := mload(add(source, 32))
        }
    }

    receive() external payable {}
}