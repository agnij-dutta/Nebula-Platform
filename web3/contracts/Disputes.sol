// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface INebulaGovernor {
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256);
}

contract Disputes is ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _disputeIds;

    enum DisputeStatus { Active, Resolved, Rejected }
    enum DisputeType { IPOwnership, MilestoneCompletion, LicenseViolation }

    struct Evidence {
        string description;
        string ipfsHash;
        uint256 timestamp;
    }

    struct Dispute {
        uint256 disputeId;
        DisputeType disputeType;
        address complainant;
        address respondent;
        uint256 relatedId; // tokenId or projectId
        string description;
        DisputeStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
        string resolution;
        mapping(address => Evidence[]) evidences;
        uint256 proposalId; // Related DAO proposal ID
    }

    mapping(uint256 => Dispute) public disputes;
    INebulaGovernor public governor;
    uint256 public constant EVIDENCE_SUBMISSION_PERIOD = 7 days;
    uint256 public constant DISPUTE_FEE = 0.1 ether;

    event DisputeCreated(
        uint256 indexed disputeId,
        DisputeType disputeType,
        address indexed complainant,
        address indexed respondent,
        uint256 relatedId
    );

    event EvidenceSubmitted(
        uint256 indexed disputeId,
        address indexed submitter,
        string ipfsHash
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        DisputeStatus status,
        string resolution
    );

    constructor(address _governorAddress) {
        governor = INebulaGovernor(_governorAddress);
    }

    function createDispute(
        DisputeType _type,
        address _respondent,
        uint256 _relatedId,
        string memory _description
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= DISPUTE_FEE, "Insufficient dispute fee");
        require(_respondent != address(0), "Invalid respondent address");
        require(_respondent != msg.sender, "Cannot dispute with yourself");

        _disputeIds.increment();
        uint256 disputeId = _disputeIds.current();

        Dispute storage dispute = disputes[disputeId];
        dispute.disputeId = disputeId;
        dispute.disputeType = _type;
        dispute.complainant = msg.sender;
        dispute.respondent = _respondent;
        dispute.relatedId = _relatedId;
        dispute.description = _description;
        dispute.status = DisputeStatus.Active;
        dispute.createdAt = block.timestamp;

        // Create a DAO proposal for this dispute
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature(
            "resolveDispute(uint256,bool,string)", 
            disputeId, 
            true, 
            ""
        );
        
        string memory proposalDescription = string(abi.encodePacked(
            "Dispute #", 
            disputeId,
            ": ",
            _description
        ));

        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            proposalDescription
        );

        dispute.proposalId = proposalId;

        emit DisputeCreated(
            disputeId,
            _type,
            msg.sender,
            _respondent,
            _relatedId
        );

        return disputeId;
    }

    function submitEvidence(
        uint256 disputeId,
        string memory description,
        string memory ipfsHash
    ) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.Active, "Dispute not active");
        require(
            msg.sender == dispute.complainant || msg.sender == dispute.respondent,
            "Not a party to dispute"
        );
        require(
            block.timestamp <= dispute.createdAt + EVIDENCE_SUBMISSION_PERIOD,
            "Evidence submission period ended"
        );

        dispute.evidences[msg.sender].push(Evidence({
            description: description,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp
        }));

        emit EvidenceSubmitted(disputeId, msg.sender, ipfsHash);
    }

    function resolveDispute(
        uint256 disputeId,
        bool infavorOfComplainant,
        string memory resolution
    ) external {
        // Only the DAO can resolve disputes
        require(msg.sender == address(governor), "Only DAO can resolve");
        
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.Active, "Dispute not active");

        dispute.status = infavorOfComplainant ? DisputeStatus.Resolved : DisputeStatus.Rejected;
        dispute.resolution = resolution;
        dispute.resolvedAt = block.timestamp;

        // Return the dispute fee to the winning party
        payable(infavorOfComplainant ? dispute.complainant : dispute.respondent)
            .transfer(DISPUTE_FEE);

        emit DisputeResolved(
            disputeId,
            dispute.status,
            resolution
        );
    }

    function getDispute(uint256 disputeId) external view returns (
        uint256 id,
        DisputeType disputeType,
        address complainant,
        address respondent,
        uint256 relatedId,
        string memory description,
        DisputeStatus status,
        uint256 createdAt,
        uint256 resolvedAt,
        string memory resolution,
        uint256 proposalId
    ) {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.disputeId,
            dispute.disputeType,
            dispute.complainant,
            dispute.respondent,
            dispute.relatedId,
            dispute.description,
            dispute.status,
            dispute.createdAt,
            dispute.resolvedAt,
            dispute.resolution,
            dispute.proposalId
        );
    }

    function getEvidence(uint256 disputeId, address party) external view returns (
        string[] memory descriptions,
        string[] memory ipfsHashes,
        uint256[] memory timestamps
    ) {
        Evidence[] storage evidences = disputes[disputeId].evidences[party];
        uint256 length = evidences.length;
        
        descriptions = new string[](length);
        ipfsHashes = new string[](length);
        timestamps = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            descriptions[i] = evidences[i].description;
            ipfsHashes[i] = evidences[i].ipfsHash;
            timestamps[i] = evidences[i].timestamp;
        }
        
        return (descriptions, ipfsHashes, timestamps);
    }
}