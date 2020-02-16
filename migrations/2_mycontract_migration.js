const Insuralink = artifacts.require('../contracts/Insuralink.sol')
const LinkToken = artifacts.require('LinkToken')
const Oracle = artifacts.require('Oracle')

module.exports = async (deployer, network, accounts) => {
  console.log("TODO")
  // Local (development) networks need their own deployment of the LINK
  // token and the Oracle contract
  if (!network.startsWith('live')) {
    console.log(accounts)
    console.log(accounts[0])
    await deployer.deploy(
      LinkToken,
    )

    await deployer.deploy(
      Insuralink,
      LinkToken.address,
      "0xBc980E67F6122F6E55fBeb9893A70c848d288B25"
    )
    
    //Inject mock data
    deployedInsura = await Insuralink.deployed()
    deployedToken = await LinkToken.deployed()
    // await deployedToken.approve(Insuralink.address, web3.utils.toWei("50"), {from: accounts[0]})
    // //Deploy contract template
    // await deployedInsura.createInsuranceContractTemplate(web3.utils.toWei("5"), web3.utils.toWei("10"),
    //   1, "Test Contract Template", 1, { from: accounts[0] })
    // await deployedInsura.buyContract(0, {from: accounts[0]})
    console.log("Test Data Injected")
  } else {
    // For live networks, use the 0 address to allow the ChainlinkRegistry
    // contract automatically retrieve the correct address for you
    //deployer.deploy(MyContract, '0x0000000000000000000000000000000000000000')
    console.log("Unsupported")
  }
}
