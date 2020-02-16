const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers')

contract('Insuralink', (accounts) => {
  const Insuralink = artifacts.require('Insuralink')
  //onst testToken = artifacts.require('MockToken')
  const LinkToken = artifacts.require('LinkToken.sol')
  //const MockDAI = artifacts.require('MockToken')
  const defaultAccount = accounts[0]

  let insuralink, link, mockDAI;
  beforeEach(async () => {
    link = await LinkToken.new()
    mockDAI = await LinkToken.new()
    for (var i = 0; i < 5; i++) {
      await mockDAI.transfer(accounts[i], web3.utils.toWei("50"))
    }
    insuralink = await Insuralink.new(
      link.address,
      mockDAI.address,
      { from: defaultAccount },
    )
  })

  describe('constructor', () => {
    it('deploys with the specified LINK token', async () => {
      assert.equal(link.address, await insuralink.getChainlinkToken())
      assert.equal(mockDAI.address, await insuralink.DAI())
    })

    // it('deploys with the specified token address', async () => {
    //   assert.equal(snx.address, await dao.SNX.call())
    // })

    // it('deploys with the specified toPass value', async () => {
    //   assert.isTrue(toPass.eq(await dao.toPass.call()))
    // })

    // context('when teamMembers is 0', () => {
    //   it('reverts', async () => {
    //     const noMembers = []
    //     await expectRevert(
    //       GrantsDAO.new(
    //         snx.address,
    //         noMembers,
    //         communityMembers,
    //         new BN(communityMembers.length),
    //         { from: defaultAccount },
    //       ),
    //       'Need at least one teamMember',
    //     )
    //   })
    // })
  })

  describe('create insurance template', () => {
    it('stores the proposal', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      var template = await insuralink.contractTemplates(0)
      assert.equal(accounts[0], template.seller)
      assert.equal(5, template.paymentFrequency)
      assert.equal(web3.utils.toWei("5"), template.paymentAmount)
      assert.equal(web3.utils.toWei("50"), template.insuranceAmount)
      assert.equal("Test Proposal Template", template.description)
    })

    it('sets the correct expiry date (may be flaky)', async () => {
      var startDate = Math.round((new Date()).getTime() / 1000);
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      var template = await insuralink.contractTemplates(0)
      assert.equal(template.validUntil.toString().substring(0),
       (startDate + 10*60).toString().substring(0)) //check down to +-10s correctness
    })
  })

  describe('buy into insurance template', () => {

    it('allows multiple users to buy into the same template', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[1]})
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[2]})
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      await insuralink.buyContract(0, {from: accounts[1]})
      await insuralink.buyContract(0, {from: accounts[2]})
      var activeContract1 = await insuralink.getContract(0)
      var activeContract2 = await insuralink.getContract(1)
      assert.equal(activeContract1[1], accounts[1])
      assert.equal(activeContract2[1], accounts[2])
    })

    it('pays the seller the first payment', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[1]})
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      var startBalance = await mockDAI.balanceOf(accounts[0])
      await insuralink.buyContract(0, {from: accounts[1]})
      var endBalance = await mockDAI.balanceOf(accounts[0])
      // seller gained 50 tokens
      assert.equal(endBalance.sub(startBalance).toString(), web3.utils.toWei("5").toString())
    })
  })

  describe('payout contract', () => {
    it('pays out the buyer when the trigger function is called', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[1]})
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      await insuralink.buyContract(0, {from: accounts[1]})
      //manually fire off event
      var startBalance = await mockDAI.balanceOf(accounts[1]);
      await insuralink.payoutInsurance(0)
      var endBalance = await mockDAI.balanceOf(accounts[1]);
      //gained 50 tokens
      assert.equal(endBalance.sub(startBalance).toString(), web3.utils.toWei("50").toString())
    })

    it('marks the contract as expired', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[1]})
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      await insuralink.buyContract(0, {from: accounts[1]})
      //manually fire off event
      await insuralink.payoutInsurance(0)
      var insuranceContract = await insuralink.getContract(0)
      //contract is now not valid
      assert.equal(insuranceContract[4], false)
    })
  })

  describe('pay premium', () => {
    it('pays the premium to the seller as required', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[1]})
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 2)
      await insuralink.buyContract(0, {from: accounts[1]})
      //manually fire off event
      var startBalance = await mockDAI.balanceOf(accounts[0]);
      await insuralink.payPremium(0, {from: accounts[1]})
      var endBalance = await mockDAI.balanceOf(accounts[0]);
      //gained 5 tokens
      assert.equal(endBalance.sub(startBalance).toString(), web3.utils.toWei("5").toString())
    })

    it('reverts if there is no more premiums to pay', async () => {
      //Allow the contract to spend 50 DAI
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"))
      await mockDAI.approve(insuralink.address, web3.utils.toWei("50"), {from: accounts[1]})
      await insuralink.createInsuranceContractTemplate(5, web3.utils.toWei("5"), web3.utils.toWei("50"), 10, "Test Proposal Template", 1)
      await insuralink.buyContract(0, {from: accounts[1]})
      //manually fire off event
      try {
        await insuralink.payPremium(0, {from: accounts[1]})
      } catch (e) {
        assert.equal(true, true)
        return
      }

      //Should not get here
      assert.equal(true, false)
    })
  })

  
})