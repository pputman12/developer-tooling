import { eqAddress } from '@celo/utils/lib/address'
import { Flags } from '@oclif/core'

import BigNumber from 'bignumber.js'
import { newCheckBuilder } from '../../utils/checks'
import { binaryPrompt, displaySendTx } from '../../utils/cli'
import { CustomFlags } from '../../utils/command'
import { ReleaseGoldBaseCommand } from '../../utils/release-gold-base'

export default class LockedCelo extends ReleaseGoldBaseCommand {
  static description =
    'Perform actions [lock, unlock, withdraw] on CELO that has been locked via the provided ReleaseGold contract.'

  static aliases = ['releasecelo:locked-celo']

  static flags = {
    ...ReleaseGoldBaseCommand.flags,
    action: Flags.string({
      char: 'a',
      options: ['lock', 'unlock', 'withdraw'],
      description: "Action to perform on contract's celo",
      required: true,
    }),
    value: CustomFlags.wei({
      required: true,
      description: 'Amount of celo to perform `action` with',
    }),
    yes: Flags.boolean({ description: 'Answer yes to prompt' }),
  }

  static examples = [
    'locked-celo --contract 0xCcc8a47BE435F1590809337BB14081b256Ae26A8 --action lock --value 10000000000000000000000',
    'locked-celo --contract 0xCcc8a47BE435F1590809337BB14081b256Ae26A8 --action unlock --value 10000000000000000000000',
    'locked-celo --contract 0xCcc8a47BE435F1590809337BB14081b256Ae26A8 --action withdraw --value 10000000000000000000000',
  ]

  async run() {
    const kit = await this.getKit()
    const { flags } = await this.parse(LockedCelo)
    const value = new BigNumber(flags.value)
    const contractAddress = await this.contractAddress()
    const checkBuilder = newCheckBuilder(this, contractAddress).isAccount(contractAddress)
    const isRevoked = await this.releaseGoldWrapper.isRevoked()
    const beneficiary = await this.releaseGoldWrapper.getBeneficiary()
    const releaseOwner = await this.releaseGoldWrapper.getReleaseOwner()
    const lockedGold = await kit.contracts.getLockedGold()
    kit.defaultAccount = isRevoked ? releaseOwner : beneficiary

    if (flags.action === 'lock') {
      // Must verify contract is account before checking pending withdrawals
      await checkBuilder.addCheck('Is not revoked', () => !isRevoked).runChecks()
      const pendingWithdrawalsValue =
        await lockedGold.getPendingWithdrawalsTotalValue(contractAddress)
      const relockValue = BigNumber.minimum(pendingWithdrawalsValue, value)
      const lockValue = value.minus(relockValue)
      await newCheckBuilder(this, contractAddress)
        .hasEnoughCelo(contractAddress, lockValue)
        .runChecks()
      const txos = await this.releaseGoldWrapper.relockGold(relockValue)
      for (const txo of txos) {
        await displaySendTx('lockedCeloRelock', txo, { from: beneficiary })
      }
      if (lockValue.gt(new BigNumber(0))) {
        const accounts = await kit.contracts.getAccounts()
        const totalValue = await this.releaseGoldWrapper.getRemainingUnlockedBalance()
        const remaining = totalValue.minus(lockValue)
        console.log('remaining', remaining.toFixed())
        if (
          !flags.yes &&
          remaining.lt(new BigNumber(2e18)) &&
          (eqAddress(await accounts.getVoteSigner(flags.contract), flags.contract) ||
            eqAddress(await accounts.getValidatorSigner(flags.contract), flags.contract))
        ) {
          const check = await binaryPrompt(
            `Only ${remaining.shiftedBy(
              -18
            )} CELO would be left unlocked, you might not be able to fund your signers. Unlock anyway?`,
            true
          )
          if (!check) {
            console.log('Cancelled')
            return
          }
        }
        await displaySendTx('lockedCeloLock', this.releaseGoldWrapper.lockGold(lockValue))
      }
    } else if (flags.action === 'unlock') {
      await checkBuilder.isNotVoting(contractAddress).hasEnoughLockedGoldToUnlock(value).runChecks()
      await displaySendTx('lockedCeloUnlock', this.releaseGoldWrapper.unlockGold(flags.value))
    } else if (flags.action === 'withdraw') {
      await checkBuilder.runChecks()
      const currentTime = Math.round(new Date().getTime() / 1000)
      let madeWithdrawal = false
      while (!madeWithdrawal) {
        const pendingWithdrawals = await lockedGold.getPendingWithdrawals(contractAddress)
        for (let i = 0; i < pendingWithdrawals.length; i++) {
          const pendingWithdrawal = pendingWithdrawals[i]
          if (pendingWithdrawal.time.isLessThan(currentTime)) {
            console.log(
              `Found available pending withdrawal of value ${pendingWithdrawal.value.toFixed()}, withdrawing`
            )
            await displaySendTx('lockedGoldWithdraw', this.releaseGoldWrapper.withdrawLockedGold(i))
            madeWithdrawal = true
          }
        }
      }
      const remainingPendingWithdrawals = await lockedGold.getPendingWithdrawals(contractAddress)
      for (const pendingWithdrawal of remainingPendingWithdrawals) {
        console.log(
          `Pending withdrawal of value ${pendingWithdrawal.value.toFixed()} available for withdrawal in ${pendingWithdrawal.time
            .minus(currentTime)
            .toFixed()} seconds.`
        )
      }
    }
  }
}
