// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IFundingEscrow {
    function createEscrow(uint256 projectId) external;
    function fundProject(uint256 projectId, uint256 milestoneId) external payable;
    function releaseMilestoneFunds(uint256 projectId, uint256 milestoneId, address payable researcher) external;
}

contract ResearchProject is ERC1155, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _projectIds;
    
    struct Milestone {
        string description;
        uint256 targetAmount;
        uint256 currentAmount;
        bool isCompleted;
        bool fundsReleased;
        string verificationCID; // IPFS hash of verification criteria
    }
    
    struct Project {
        uint256 projectId;
        string title;
        string description;
        address researcher;
        uint256 totalFunding;
        uint256 currentFunding;
        bool isActive;
        uint256[] milestoneIds;
        string category;
        uint256 createdAt;
        string metadataCID; // IPFS hash for extended project details
        bool isCancelled;
        uint256 deadline;
    }

    IFundingEscrow public fundingEscrow;
    address public oracle;
    
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed researcher,
        string title,
        string category,
        string metadataCID
    );
    
    event MilestoneAdded(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        string description,
        uint256 targetAmount,
        string verificationCID
    );
    
    event ProjectFunded(
        uint256 indexed projectId,
        address indexed backer,
        uint256 amount
    );
    
    event MilestoneCompleted(
        uint256 indexed projectId,
        uint256 indexed milestoneId
    );
    
    event FundsReleased(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        uint256 amount
    );

    event ProjectCancelled(uint256 indexed projectId);
    
    modifier onlyResearcher(uint256 projectId) {
        require(projects[projectId].researcher == msg.sender, "Not the researcher");
        _;
    }
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call");
        _;
    }

    constructor(address _fundingEscrow, address _oracle) ERC1155("") {
        fundingEscrow = IFundingEscrow(_fundingEscrow);
        oracle = _oracle;
    }

    function createProject(
        string memory title,
        string memory description,
        string memory category,
        string memory metadataCID,
        string[] memory milestoneDescriptions,
        uint256[] memory milestoneTargets,
        string[] memory verificationCIDs,
        uint256 deadline
    ) external nonReentrant returns (uint256) {
        require(milestoneDescriptions.length == milestoneTargets.length, "Mismatched milestone inputs");
        require(milestoneDescriptions.length == verificationCIDs.length, "Mismatched verification CIDs");
        require(milestoneDescriptions.length > 0, "No milestones provided");
        require(deadline > block.timestamp, "Invalid deadline");

        _projectIds.increment();
        uint256 projectId = _projectIds.current();
        
        uint256[] memory mIds = new uint256[](milestoneDescriptions.length);
        uint256 totalTarget = 0;
        
        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            mIds[i] = i + 1;
            milestones[projectId][i + 1] = Milestone({
                description: milestoneDescriptions[i],
                targetAmount: milestoneTargets[i],
                currentAmount: 0,
                isCompleted: false,
                fundsReleased: false,
                verificationCID: verificationCIDs[i]
            });
            
            totalTarget += milestoneTargets[i];
            emit MilestoneAdded(projectId, i + 1, milestoneDescriptions[i], milestoneTargets[i], verificationCIDs[i]);
        }

        projects[projectId] = Project({
            projectId: projectId,
            title: title,
            description: description,
            researcher: msg.sender,
            totalFunding: totalTarget,
            currentFunding: 0,
            isActive: true,
            milestoneIds: mIds,
            category: category,
            createdAt: block.timestamp,
            metadataCID: metadataCID,
            isCancelled: false,
            deadline: deadline
        });

        // Create escrow for the project
        fundingEscrow.createEscrow(projectId);
        
        emit ProjectCreated(projectId, msg.sender, title, category, metadataCID);
        return projectId;
    }

    function fundProject(uint256 projectId, uint256 milestoneId) external payable nonReentrant {
        Project storage project = projects[projectId];
        require(project.isActive, "Project not active");
        require(!project.isCancelled, "Project cancelled");
        require(block.timestamp <= project.deadline, "Funding deadline passed");
        require(msg.value > 0, "Amount must be greater than 0");
        
        Milestone storage milestone = milestones[projectId][milestoneId];
        require(milestone.currentAmount + msg.value <= milestone.targetAmount, "Exceeds milestone target");

        // Forward funds to escrow
        fundingEscrow.fundProject{value: msg.value}(projectId, milestoneId);
        
        project.currentFunding += msg.value;
        milestone.currentAmount += msg.value;
        contributions[projectId][msg.sender] += msg.value;
        
        // Mint ERC1155 token as proof of contribution
        _mint(msg.sender, projectId, msg.value, "");
        
        emit ProjectFunded(projectId, msg.sender, msg.value);
        
        // Auto-complete milestone if target reached
        if (milestone.currentAmount >= milestone.targetAmount && !milestone.isCompleted) {
            milestone.isCompleted = true;
            emit MilestoneCompleted(projectId, milestoneId);
        }
    }

    function verifyAndReleaseFunds(
        uint256 projectId, 
        uint256 milestoneId, 
        string calldata proofCID
    ) external onlyOracle {
        Project storage project = projects[projectId];
        require(project.isActive, "Project not active");
        require(!project.isCancelled, "Project cancelled");
        
        Milestone storage milestone = milestones[projectId][milestoneId];
        require(!milestone.fundsReleased, "Funds already released");
        require(milestone.isCompleted, "Milestone not completed");
        
        // Verify proof matches the milestone criteria
        require(
            keccak256(abi.encodePacked(proofCID)) == 
            keccak256(abi.encodePacked(milestone.verificationCID)),
            "Invalid verification proof"
        );

        milestone.fundsReleased = true;
        
        // Release funds through escrow
        fundingEscrow.releaseMilestoneFunds(
            projectId,
            milestoneId,
            payable(project.researcher)
        );
        
        emit FundsReleased(projectId, milestoneId, milestone.currentAmount);
    }

    function cancelProject(uint256 projectId) external onlyResearcher(projectId) {
        Project storage project = projects[projectId];
        require(project.isActive, "Project not active");
        require(!project.isCancelled, "Already cancelled");
        
        project.isActive = false;
        project.isCancelled = true;
        
        emit ProjectCancelled(projectId);
    }

    // View functions
    function getProject(uint256 projectId) external view returns (
        string memory title,
        string memory description,
        address researcher,
        uint256 totalFunding,
        uint256 currentFunding,
        bool isActive,
        string memory category,
        uint256 createdAt,
        string memory metadataCID,
        bool isCancelled,
        uint256 deadline
    ) {
        Project storage project = projects[projectId];
        return (
            project.title,
            project.description,
            project.researcher,
            project.totalFunding,
            project.currentFunding,
            project.isActive,
            project.category,
            project.createdAt,
            project.metadataCID,
            project.isCancelled,
            project.deadline
        );
    }

    function getMilestone(uint256 projectId, uint256 milestoneId) external view returns (
        string memory description,
        uint256 targetAmount,
        uint256 currentAmount,
        bool isCompleted,
        bool fundsReleased,
        string memory verificationCID
    ) {
        Milestone storage milestone = milestones[projectId][milestoneId];
        return (
            milestone.description,
            milestone.targetAmount,
            milestone.currentAmount,
            milestone.isCompleted,
            milestone.fundsReleased,
            milestone.verificationCID
        );
    }

    function getContribution(uint256 projectId, address backer) external view returns (uint256) {
        return contributions[projectId][backer];
    }
}