import { CeloTxReceipt } from '@celo/connect/lib/types'
import { addressToPublicKey } from '@celo/utils/lib/signatureUtils'
import BigNumber from 'bignumber.js'
import Web3 from 'web3'
import { startAndFinishEpochProcess } from '../test-utils/utils'

import { NULL_ADDRESS } from '@celo/base'
import { testWithAnvilL2 } from '@celo/dev-utils/anvil-test'
import { timeTravel } from '@celo/dev-utils/ganache-test'
import { newKitFromWeb3 } from '../kit'
import { AccountsWrapper } from './Accounts'
import { ElectionWrapper } from './Election'
import { LockedGoldWrapper } from './LockedGold'
import { ValidatorsWrapper } from './Validators'

const minLockedGoldValue = Web3.utils.toWei('10000', 'ether') // 10k gold

jest.setTimeout(20000)

testWithAnvilL2('Election Wrapper', (web3) => {
  const ZERO_GOLD = new BigNumber(web3.utils.toWei('0', 'ether'))
  const ONE_HUNDRED_GOLD = new BigNumber(web3.utils.toWei('100', 'ether'))
  const ONE_HUNDRED_ONE_GOLD = new BigNumber(web3.utils.toWei('101', 'ether'))
  const TWO_HUNDRED_GOLD = new BigNumber(web3.utils.toWei('200', 'ether'))
  const TWO_HUNDRED_ONE_GOLD = new BigNumber(web3.utils.toWei('201', 'ether'))
  const THREE_HUNDRED_GOLD = new BigNumber(web3.utils.toWei('300', 'ether'))
  const GROUP_COMMISSION = new BigNumber(0.1)
  const kit = newKitFromWeb3(web3)
  let accounts: string[] = []
  let election: ElectionWrapper
  let accountsInstance: AccountsWrapper
  let validators: ValidatorsWrapper
  let lockedGold: LockedGoldWrapper

  beforeAll(async () => {
    accounts = await kit.connection.getAccounts()

    election = await kit.contracts.getElection()

    validators = await kit.contracts.getValidators()

    lockedGold = await kit.contracts.getLockedGold()

    accountsInstance = await kit.contracts.getAccounts()
  })

  afterAll(async () => {
    kit.connection.stop()
  })

  const registerAccountWithLockedGold = async (
    account: string,
    value: string = minLockedGoldValue
  ) => {
    if (!(await accountsInstance.isAccount(account))) {
      await accountsInstance.createAccount().sendAndWaitForReceipt({ from: account })
    }
    await lockedGold.lock().sendAndWaitForReceipt({ from: account, value })
  }

  const setupGroup = async (groupAccount: string) => {
    await registerAccountWithLockedGold(groupAccount, new BigNumber(minLockedGoldValue).toFixed())
    await (await validators.registerValidatorGroup(GROUP_COMMISSION)).sendAndWaitForReceipt({
      from: groupAccount,
    })
  }

  const setupValidator = async (validatorAccount: string) => {
    await registerAccountWithLockedGold(validatorAccount)
    const ecdsaPublicKey = await addressToPublicKey(validatorAccount, kit.connection.sign)
    await validators.registerValidatorNoBls(ecdsaPublicKey).sendAndWaitForReceipt({
      from: validatorAccount,
    })
  }

  const setupGroupAndAffiliateValidator = async (
    groupAccount: string,
    validatorAccount: string
  ) => {
    await setupGroup(groupAccount)
    await setupValidator(validatorAccount)
    await validators.affiliate(groupAccount).sendAndWaitForReceipt({ from: validatorAccount })
    await (await validators.addMember(groupAccount, validatorAccount)).sendAndWaitForReceipt({
      from: groupAccount,
    })
  }

  const activateAndVote = async (groupAccount: string, userAccount: string, amount: BigNumber) => {
    await (await election.vote(groupAccount, amount)).sendAndWaitForReceipt({ from: userAccount })
    const epochDuraction = await kit.getEpochSize()
    await timeTravel(epochDuraction + 1, web3)
    await startAndFinishEpochProcess(kit)

    const txList = await election.activate(userAccount)

    const promises: Promise<CeloTxReceipt>[] = []

    for (const tx of txList) {
      const promise = tx.sendAndWaitForReceipt({ from: userAccount })
      promises.push(promise)
    }

    await Promise.all(promises)
  }

  describe('ElectionWrapper', () => {
    let groupAccount: string
    let validatorAccount: string
    let userAccount: string

    beforeEach(async () => {
      groupAccount = accounts[0]
      validatorAccount = accounts[1]
      userAccount = accounts[2]

      await setupGroupAndAffiliateValidator(groupAccount, validatorAccount)
      await registerAccountWithLockedGold(userAccount)
    })

    describe('#getValidatorGroupVotes', () => {
      // Confirm base assumptions once to avoid duplicating test code later
      test('shows non-empty group as eligible', async () => {
        const groupVotesBefore = await election.getValidatorGroupVotes(groupAccount)
        expect(groupVotesBefore.eligible).toBe(true)
      })

      test('shows empty group as ineligible', async () => {
        await validators.deaffiliate().sendAndWaitForReceipt({ from: validatorAccount })
        const groupVotesAfter = await election.getValidatorGroupVotes(groupAccount)
        expect(groupVotesAfter.eligible).toBe(false)
      })
    })

    describe('#vote', () => {
      beforeEach(async () => {
        await (await election.vote(groupAccount, ONE_HUNDRED_GOLD)).sendAndWaitForReceipt({
          from: userAccount,
        })
      })
      it('votes', async () => {
        const totalGroupVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(totalGroupVotes).toEqual(ONE_HUNDRED_GOLD)
      })

      test('total votes remain unchanged when group becomes ineligible', async () => {
        await validators.deaffiliate().sendAndWaitForReceipt({ from: validatorAccount })
        const totalGroupVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(totalGroupVotes).toEqual(ONE_HUNDRED_GOLD)
      })
    })

    describe('#activate', () => {
      beforeEach(async () => {
        await (await election.vote(groupAccount, ONE_HUNDRED_GOLD)).sendAndWaitForReceipt({
          from: userAccount,
        })
        const epochDuraction = await kit.getEpochSize()

        await timeTravel(epochDuraction + 1, web3)

        await startAndFinishEpochProcess(kit)

        const txList = await election.activate(userAccount)
        const promises: Promise<CeloTxReceipt>[] = []
        for (const tx of txList) {
          const promise = tx.sendAndWaitForReceipt({ from: userAccount })
          promises.push(promise)
        }
        await Promise.all(promises)
      })

      it('activates vote', async () => {
        const activeVotes = await election.getActiveVotesForGroup(groupAccount)
        expect(activeVotes).toEqual(ONE_HUNDRED_GOLD)
      })

      test('active votes remain unchanged when group becomes ineligible', async () => {
        await validators.deaffiliate().sendAndWaitForReceipt({ from: validatorAccount })
        const activeVotes = await election.getActiveVotesForGroup(groupAccount)
        expect(activeVotes).toEqual(ONE_HUNDRED_GOLD)
      })
    })

    describe('#revokeActive', () => {
      beforeEach(async () => {
        await activateAndVote(groupAccount, userAccount, ONE_HUNDRED_GOLD)
      })

      it('revokes active', async () => {
        await (
          await election.revokeActive(userAccount, groupAccount, ONE_HUNDRED_GOLD)
        ).sendAndWaitForReceipt({
          from: userAccount,
        })

        const remainingVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(remainingVotes).toEqual(ZERO_GOLD)
      })

      it('revokes active when group is ineligible', async () => {
        await validators.deaffiliate().sendAndWaitForReceipt({ from: validatorAccount })
        await (
          await election.revokeActive(userAccount, groupAccount, ONE_HUNDRED_GOLD)
        ).sendAndWaitForReceipt({ from: userAccount })

        const remainingVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(remainingVotes).toEqual(ZERO_GOLD)
      })
    })

    describe('#revokePending', () => {
      beforeEach(async () => {
        await (await election.vote(groupAccount, ONE_HUNDRED_GOLD)).sendAndWaitForReceipt({
          from: userAccount,
        })
      })

      it('revokes pending', async () => {
        await (
          await election.revokePending(userAccount, groupAccount, ONE_HUNDRED_GOLD)
        ).sendAndWaitForReceipt({
          from: userAccount,
        })
        const remainingVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(remainingVotes).toEqual(ZERO_GOLD)
      })

      it('revokes pending when group is ineligible', async () => {
        await validators.deaffiliate().sendAndWaitForReceipt({ from: validatorAccount })
        await (
          await election.revokePending(userAccount, groupAccount, ONE_HUNDRED_GOLD)
        ).sendAndWaitForReceipt({
          from: userAccount,
        })
        const remainingVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(remainingVotes).toEqual(ZERO_GOLD)
      })
    })

    describe('#revoke', () => {
      beforeEach(async () => {
        await activateAndVote(groupAccount, userAccount, TWO_HUNDRED_GOLD)
        await (await election.vote(groupAccount, ONE_HUNDRED_GOLD)).sendAndWaitForReceipt({
          from: userAccount,
        })
      })

      it('revokes active and pending votes', async () => {
        const revokeTransactionsList = await election.revoke(
          userAccount,
          groupAccount,
          THREE_HUNDRED_GOLD
        )
        for (const tx of revokeTransactionsList) {
          await tx.sendAndWaitForReceipt({ from: userAccount })
        }
        const remainingVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(remainingVotes).toEqual(ZERO_GOLD)
      })

      it('revokes active and pending votes when group is ineligible', async () => {
        await validators.deaffiliate().sendAndWaitForReceipt({ from: validatorAccount })
        const revokeTransactionsList = await election.revoke(
          userAccount,
          groupAccount,
          THREE_HUNDRED_GOLD
        )
        for (const tx of revokeTransactionsList) {
          await tx.sendAndWaitForReceipt({ from: userAccount })
        }
        const remainingVotes = await election.getTotalVotesForGroup(groupAccount)
        expect(remainingVotes).toEqual(ZERO_GOLD)
      })
    })
  })

  describe('#findLesserAndGreaterAfterVote', () => {
    let groupAccountA: string
    let groupAccountB: string
    let groupAccountC: string
    let validatorAccountA: string
    let validatorAccountB: string
    let validatorAccountC: string
    let userAccount: string

    beforeEach(async () => {
      ;[
        groupAccountA,
        groupAccountB,
        groupAccountC,
        validatorAccountA,
        validatorAccountB,
        validatorAccountC,
        userAccount,
      ] = accounts

      await registerAccountWithLockedGold(userAccount)

      // Cant `await Promise.all()` because of race condition when finding
      // lesser and greater addresses for voting and adding a member to a group.
      await setupGroupAndAffiliateValidator(groupAccountA, validatorAccountA)
      await setupGroupAndAffiliateValidator(groupAccountB, validatorAccountB)
      await setupGroupAndAffiliateValidator(groupAccountC, validatorAccountC)

      await activateAndVote(groupAccountA, userAccount, TWO_HUNDRED_GOLD)
      await activateAndVote(groupAccountB, userAccount, TWO_HUNDRED_ONE_GOLD)
      await activateAndVote(groupAccountC, userAccount, ONE_HUNDRED_ONE_GOLD)
    })

    test('Validator groups should be in the correct order', async () => {
      await (await election.vote(groupAccountA, ONE_HUNDRED_GOLD)).sendAndWaitForReceipt({
        from: userAccount,
      })
      const revokeTransactionsList = await election.revoke(
        userAccount,
        groupAccountA,
        TWO_HUNDRED_GOLD
      )
      for (const tx of revokeTransactionsList) {
        await tx.sendAndWaitForReceipt({ from: userAccount })
      }
      const groupOrder = await election.findLesserAndGreaterAfterVote(groupAccountA, ZERO_GOLD)
      expect(groupOrder).toEqual({ lesser: NULL_ADDRESS, greater: groupAccountC })
    })
  })
})
