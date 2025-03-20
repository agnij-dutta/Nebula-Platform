// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract FundingEscrow is ReentrancyGuard {
    using Counters for Counters.Counter;
    
    AggregatorV3Interface private immutable priceFeed;
    address public immutable oracle;
    address public researchProjectContract;
    
    struct Escrow {
        uint256 projectId;
        mapping(uint256 => uint256) milestoneFunds; // milestoneId => amount
        mapping(uint256 => bool) milestoneReleased; // milestoneId => released
        mapping(address => uint256) contributions; // backer => amount
        uint256 totalFunds;
        bool isActive;
    }

    mapping(uint256 => Escrow) public escrows;
    
    event FundsDeposited(uint256 indexed projectId, address indexed backer, uint256 amount);
    event MilestoneFundsReleased(uint256 indexed projectId, uint256 indexed milestoneId, uint256 amount);
    event FundsRefunded(uint256 indexed projectId, address indexed backer, uint256 amount);
    
    constructor(address _oracle, address _priceFeedAddress, address _researchProjectContract) {
        oracle = _oracle;
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        researchProjectContract = _researchProjectContract;
    }
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call");
        _;
    }

    function setResearchProjectContract(address _researchProjectContract) external {
        require(msg.sender == oracle, "Only oracle can update");
        researchProjectContract = _researchProjectContract;
    }

    function createEscrow(uint256 projectId) external {
        require(msg.sender == researchProjectContract, "Only research contract can create");
        Escrow storage escrow = escrows[projectId];
        escrow.projectId = projectId;
        escrow.isActive = true;
    }

    function fundProject(uint256 projectId, uint256 milestoneId) external payable nonReentrant {
        Escrow storage escrow = escrows[projectId];
        require(escrow.isActive, "Project not active");
        require(msg.value > 0, "Must send funds");

        escrow.contributions[msg.sender] += msg.value;
        escrow.milestoneFunds[milestoneId] += msg.value;
        escrow.totalFunds += msg.value;

        emit FundsDeposited(projectId, msg.sender, msg.value);
    }

    function getLatestAVAXPrice() public view returns (uint256) {
        (,int price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }
    
    function convertToAVAX(uint256 usdAmount) public view returns (uint256) {
        uint256 price = getLatestAVAXPrice();
        return (usdAmount * 1e18) / price;
    }

    function releaseMilestoneFunds(
        uint256 projectId, 
        uint256 milestoneId, 
        address payable researcher
    ) external onlyOracle nonReentrant {
        Escrow storage escrow = escrows[projectId];
        require(escrow.isActive, "Project not active");
        require(!escrow.milestoneReleased[milestoneId], "Funds already released");
        
        uint256 amount = escrow.milestoneFunds[milestoneId];
        require(amount > 0, "No funds to release");
        
        escrow.milestoneReleased[milestoneId] = true;
        researcher.transfer(amount);
        
        emit MilestoneFundsReleased(projectId, milestoneId, amount);
    }

    function refundBacker(uint256 projectId) external nonReentrant {
        Escrow storage escrow = escrows[projectId];
        require(escrow.isActive, "Project not active");
        
        uint256 contribution = escrow.contributions[msg.sender];
        require(contribution > 0, "No funds to refund");
        
        escrow.contributions[msg.sender] = 0;
        escrow.totalFunds -= contribution;
        
        payable(msg.sender).transfer(contribution);
        
        emit FundsRefunded(projectId, msg.sender, contribution);
    }

    function getContribution(uint256 projectId, address backer) external view returns (uint256) {
        return escrows[projectId].contributions[backer];
    }

    function getMilestoneFunds(uint256 projectId, uint256 milestoneId) external view returns (uint256) {
        return escrows[projectId].milestoneFunds[milestoneId];
    }

    function isMilestoneReleased(uint256 projectId, uint256 milestoneId) external view returns (bool) {
        return escrows[projectId].milestoneReleased[milestoneId];
    }

    receive() external payable {
        revert("Use fundProject function to send funds");
    }
}