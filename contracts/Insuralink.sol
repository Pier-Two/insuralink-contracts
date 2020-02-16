pragma solidity 0.4.24;

import "chainlink/contracts/ChainlinkClient.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./lib/IERC20.sol";

contract Insuralink is ChainlinkClient, Ownable {

  struct InsuranceContractTemplate {
    address seller;
    uint256 paymentFrequency;
    uint256 paymentAmount;
    uint256 totalNumberOfPayments;
    uint256 insuranceAmount;
    uint256 validUntil;
    string description;
    uint256 id;
  }

  struct InsuranceContract {
    InsuranceContractTemplate contractTemplate;
    address buyer;
    uint256 id;
    bool valid;
    uint256 numberOfPayments;
    uint256 lastPaymentTime;
  }

  IERC20 public DAI;
  uint256 public templateCounter;
  uint256 public activeCounter;
  mapping (uint256 => InsuranceContractTemplate) public contractTemplates;
  mapping (uint256 => InsuranceContract) public activeContracts;
  mapping (address => uint256[]) public templatesByUser;
  mapping (address => uint256[]) public activeContractsByUser;

  /**
   * @notice Deploy the contract with a specified address for the LINK
   * and Oracle contract addresses
   * @dev Sets the storage for the specified addresses
   * @param _link The address of the LINK token contract
   */
  constructor(address _link, address daiToken) public {
    //TODO set chainlink oracle address (for now just 1)
    if (_link == address(0)) {
      setPublicChainlinkToken();
    } else {
      setChainlinkToken(_link);
    }

    DAI = IERC20(daiToken);
    //TODO
    // setChainlinkOracle(address(0));
  }

  function createInsuranceContractTemplate(uint256 paymentAmount, uint256 insuranceAmount, uint256 length,
    string memory description, uint256 totalNumberOfPayments) public returns(uint256) {
      //Ensure DAI is deposited on creation
      require(DAI.transferFrom(msg.sender, address(this), insuranceAmount));
      uint256 validUntil = now + (length * (1 minutes));
      InsuranceContractTemplate memory template = InsuranceContractTemplate(msg.sender, 1, 
        paymentAmount, totalNumberOfPayments, insuranceAmount, validUntil, description, templateCounter);
      contractTemplates[templateCounter] = template;
      templatesByUser[msg.sender].push(template.id);
      templateCounter++;
      return template.id;
  }

  function buyContract(uint256 contractTemplateId) public {
    InsuranceContractTemplate memory template = contractTemplates[contractTemplateId];
    //Pay first insurance payment on buy in
    require(DAI.transferFrom(msg.sender, template.seller, template.paymentAmount));
    InsuranceContract memory insuranceContract = InsuranceContract(template, msg.sender, activeCounter, true, 0, 0);
    activeContractsByUser[msg.sender].push(insuranceContract.id);
    activeContractsByUser[template.seller].push(insuranceContract.id);
    activeContracts[activeCounter] = insuranceContract;
    activeContracts[activeCounter].numberOfPayments++;
    activeCounter++;
  }

  /** Function to trigger payout
  * Called by the oracle when the sensor passes the threshold
  * TODO ensure only the oracle(s) can call this function
  */
  function payoutInsurance(uint256 contractId) public returns(bool) {
    InsuranceContract memory insuranceContract = activeContracts[contractId];
    require(insuranceContract.valid);
    require(DAI.transfer(insuranceContract.buyer, insuranceContract.contractTemplate.insuranceAmount));
    activeContracts[contractId].valid = false;
  }
  
  /**
  * Function to allow the user to pay their premium on the contract
  */
  function payPremium(uint256 contractId) public returns(bool) {
    InsuranceContract memory insuranceContract = activeContracts[contractId];
    require(insuranceContract.valid && msg.sender == insuranceContract.buyer);
    require(insuranceContract.numberOfPayments < insuranceContract.contractTemplate.totalNumberOfPayments);
    require(DAI.transferFrom(msg.sender, insuranceContract.contractTemplate.seller,
      insuranceContract.contractTemplate.paymentAmount));
    activeContracts[contractId].numberOfPayments++;
  }

  function getContract(uint256 contractId) public view returns(address, address, uint256, uint256, bool, uint256, uint256) {
    InsuranceContract memory insuranceContract = activeContracts[contractId];
    return(insuranceContract.contractTemplate.seller, insuranceContract.buyer, 
      insuranceContract.contractTemplate.id, insuranceContract.id, insuranceContract.valid,
      insuranceContract.numberOfPayments, insuranceContract.contractTemplate.totalNumberOfPayments);
  }

  function getActiveContractTemplate(uint256 contractId) public view returns(address, uint256, uint256, uint256,
      uint256, string, uint256) {
    InsuranceContractTemplate memory template = activeContracts[contractId].contractTemplate;
    return (template.seller, template.paymentFrequency, template.paymentAmount, template.insuranceAmount,
      template.validUntil, template.description, template.id);
  }

  function getContractTemplate(uint256 templateId) public view returns(address, uint256, uint256, uint256,
      uint256, string, uint256){
    InsuranceContractTemplate memory template = contractTemplates[templateId];
    return (template.seller, template.paymentFrequency, template.paymentAmount, template.insuranceAmount,
      template.validUntil, template.description, template.id);
  }

  function getActiveContractsByUser(address user) public view returns(uint256[]) {
    return activeContractsByUser[user];
  }

  //TODO
  //depositDai

  //Chainlink Code
  /**
   * @notice Returns the address of the LINK token
   * @dev This is the public implementation for chainlinkTokenAddress, which is
   * an internal method of the ChainlinkClient contract
   */
  function getChainlinkToken() public view returns (address) {
    return chainlinkTokenAddress();
  }

  /**
   * @notice The fulfill method from requests created by this contract
   * @dev The recordChainlinkFulfillment protects this function from being called
   * by anyone other than the oracle address that the request was sent to
   * @param _requestId The ID that was generated for the request
   * @param _data The answer provided by the oracle
   */
  function fulfill(bytes32 _requestId, uint256 _data)
    public
    recordChainlinkFulfillment(_requestId)
  {
    //TODO
  }

  /**
   * @notice Allows the owner to withdraw any LINK balance on the contract
   */
  function withdrawLink() public onlyOwner {
    LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
    require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
  }

  /**
   * @notice Call this method if no response is received within 5 minutes
   * @param _requestId The ID that was generated for the request to cancel
   * @param _payment The payment specified for the request to cancel
   * @param _callbackFunctionId The bytes4 callback function ID specified for
   * the request to cancel
   * @param _expiration The expiration generated for the request to cancel
   */
  function cancelRequest(
    bytes32 _requestId,
    uint256 _payment,
    bytes4 _callbackFunctionId,
    uint256 _expiration
  )
    public
    onlyOwner
  {
    cancelChainlinkRequest(_requestId, _payment, _callbackFunctionId, _expiration);
  }
}