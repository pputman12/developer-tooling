import { CELO_DERIVATION_PATH_BASE } from '@celo/base/lib/account'
import { zeroRange } from '@celo/base/lib/collections'
import { Address, CeloTx, EncodedTransaction, ReadOnlyWallet } from '@celo/connect'
import Ledger from '@celo/hw-app-eth'
import { encodeTransaction, isCIP64, isEIP1559, rlpEncodedTx } from '@celo/wallet-base'
import { RemoteWallet } from '@celo/wallet-remote'
import { TransportError, TransportStatusError } from '@ledgerhq/errors'
import debugFactory from 'debug'
import { SemVer } from 'semver'
import { LedgerSigner } from './ledger-signer'
import { meetsVersionRequirements, transportErrorFriendlyMessage } from './ledger-utils'

/*
 * @deprecated this constant hardcodes the change index to 0. However we actually ignore that.
 */
export const CELO_BASE_DERIVATION_PATH = `${CELO_DERIVATION_PATH_BASE.slice(2)}/0`
const ADDRESS_QTY = 5

// Validates an address using the Ledger
export enum AddressValidation {
  // Validates every address required only when the ledger is initialized
  initializationOnly,
  // Validates the address every time a transaction is made
  everyTransaction,
  // Validates the address the first time a transaction is made for that specific address
  firstTransactionPerAddress,
  // Never validates the addresses
  never,
}

interface LedgerWalletSetup {
  derivationPathIndexes?: number[]
  changeIndexes?: number[]
  baseDerivationPath?: string
  ledgerAddressValidation?: AddressValidation
}

export async function newLedgerWalletWithSetup(
  transport: any,
  {
    derivationPathIndexes,
    baseDerivationPath,
    ledgerAddressValidation,
    changeIndexes,
  }: LedgerWalletSetup
): Promise<LedgerWallet> {
  const wallet = new LedgerWallet(
    transport,
    derivationPathIndexes,
    baseDerivationPath,
    changeIndexes,
    ledgerAddressValidation
  )
  await wallet.init()
  return wallet
}

const debug = debugFactory('kit:wallet:ledger')

export class LedgerWallet extends RemoteWallet<LedgerSigner> implements ReadOnlyWallet {
  static MIN_VERSION_SUPPORTED = '1.0.0'
  static MIN_VERSION_TOKEN_DATA = '1.0.2'
  static MIN_VERSION_EIP1559 = '1.2.0'
  ledger: Ledger | undefined

  /**
   * @param transport Transport to connect the ledger device
   * @param derivationPathIndexes number array of "address_index" for the base derivation path.
   * Default: Array[0..5].
   * Example: [3, 99, 53] will retrieve the derivation paths of
   * [`${baseDerivationPath}/0/3`, `${baseDerivationPath}/0/99`, `${baseDerivationPath}/0/53`]
   * @param baseDerivationPath base derivation path. Default: "44'/52752'/0'"
   * @param changeIndexes number array of "change" for the base derivation path.
   * Default: [0].
   * Example: [0, 1] will retrieve the derivation paths of [`${baseDerivationPath}/0/${address_index}`, `${baseDerivationPath}/1/${address_index}`, `${baseDerivationPath}/2/${address_index}`]
   * @param ledgerAddressValidation AddressValidation enum to validate addresses. Default: AddressValidation.firstTransactionPerAddress
   */
  constructor(
    readonly transport: any = {},
    readonly derivationPathIndexes: number[] = zeroRange(ADDRESS_QTY),
    readonly baseDerivationPath: string = CELO_BASE_DERIVATION_PATH,
    readonly changeIndexes: number[] = [0],
    readonly ledgerAddressValidation: AddressValidation = AddressValidation.firstTransactionPerAddress
  ) {
    super()

    validateIndexes(derivationPathIndexes, 'address index')
    validateIndexes(changeIndexes, 'change index')
    // Remove the 'm/' prefix if it exists since we dont expect it here but that is how derivaiton path is used in the rest of the code
    this.baseDerivationPath = baseDerivationPath.startsWith('m/')
      ? baseDerivationPath.slice(2)
      : baseDerivationPath
  }

  async signTransaction(txParams: CeloTx): Promise<EncodedTransaction> {
    const rlpEncoded = await this.rlpEncodedTxForLedger(txParams)
    const addToV = 27

    // Get the signer from the 'from' field
    const fromAddress = txParams.from!.toString()
    const signer = this.getSigner(fromAddress)
    const signature = await signer!.signTransaction(addToV, rlpEncoded)

    return encodeTransaction(rlpEncoded, signature)
  }

  async rlpEncodedTxForLedger(txParams: CeloTx) {
    if (!txParams) {
      throw new Error('No transaction object given!')
    }

    const deviceApp = await this.retrieveAppConfiguration()
    const version = new SemVer(deviceApp.version)

    if (
      deviceApp.appName !== 'celo' ||
      meetsVersionRequirements(version, { minimum: LedgerWallet.MIN_VERSION_EIP1559 })
    ) {
      if (txParams.gasPrice && txParams.feeCurrency && txParams.feeCurrency !== '0x') {
        throw new Error(
          `celo no longer supports legacy celo transactions. Replace "gasPrice" with "maxFeePerGas".`
        )
      }
      if (txParams.gasPrice) {
        throw new Error(
          'ethereum-legacy transactions are not supported, please try sending a more modern transaction instead (eip1559, cip64, etc.)'
        )
      }
      const isCeloSpecificTx = isCIP64(txParams)
      if (isEIP1559(txParams) || isCeloSpecificTx) {
        if (isCeloSpecificTx && deviceApp.appName !== 'celo') {
          throw new Error(
            'To submit celo-specific transactions you must use the celo app on your ledger device.'
          )
        }
        return rlpEncodedTx(txParams)
      } else {
        throw new Error(
          'only eip1559 and cip64 transactions can be signd by this version of celo ledger app'
        )
      }
      // but if not celo as layer 2 and as layer 1 are different
    } else {
      throw new Error(
        `celo ledger app version must be at least ${LedgerWallet.MIN_VERSION_EIP1559} to sign transactions supported on celo after the L2 upgrade`
      )
    }
  }

  protected async loadAccountSigners(): Promise<Map<Address, LedgerSigner>> {
    if (!this.ledger) {
      this.ledger = this.generateNewLedger(this.transport)
    }
    debug('Fetching addresses from the ledger')
    let addressToSigner = new Map<Address, LedgerSigner>()
    try {
      addressToSigner = await this.retrieveAccounts()
    } catch (error) {
      if (error instanceof TransportStatusError || error instanceof TransportError) {
        transportErrorFriendlyMessage(error)
      }
      throw error
    }
    return addressToSigner
  }

  // Extracted for testing purpose
  private generateNewLedger(transport: any) {
    return new Ledger(transport)
  }

  private async retrieveAccounts(): Promise<Map<Address, LedgerSigner>> {
    const addressToSigner = new Map<Address, LedgerSigner>()
    const appConfiguration = await this.retrieveAppConfiguration()
    const validationRequired = this.ledgerAddressValidation === AddressValidation.initializationOnly
    // https://trezor.io/learn/a/what-is-bip44
    const [purpose, coinType, account] = this.baseDerivationPath.split('/')
    // Each address must be retrieved synchronously, (ledger lock)
    for (const changeIndex of this.changeIndexes) {
      for (const addressIndex of this.derivationPathIndexes) {
        const derivationPath = `${purpose}/${coinType}/${account}/${changeIndex}/${addressIndex}`
        console.info(`Fetching address for derivation path ${derivationPath}`)
        const addressInfo = await this.ledger!.getAddress(derivationPath, validationRequired)
        addressToSigner.set(
          addressInfo.address!,
          new LedgerSigner(
            this.ledger!,
            derivationPath,
            this.ledgerAddressValidation,
            appConfiguration
          )
        )
      }
    }
    return addressToSigner
  }

  private async retrieveAppConfiguration(): Promise<{
    arbitraryDataEnabled: number
    version: string
    appName: string
  }> {
    const appName = await this.retrieveAppName()
    const appConfiguration = await this.ledger!.getAppConfiguration()
    if (appName === 'celo') {
      if (new SemVer(appConfiguration.version).compare(LedgerWallet.MIN_VERSION_SUPPORTED) === -1) {
        throw new Error(
          `Due to technical issues, we require the users to update their ledger celo-app to >= ${LedgerWallet.MIN_VERSION_SUPPORTED}. You can do this on ledger-live by updating the celo-app in the app catalog.`
        )
      }
    } else if (appName === 'ethereum') {
      console.warn(
        `Beware, you opened the Ethereum app instead of the Celo app. Some features may not work correctly, including token transfers.`
      )
    } else {
      console.error(
        `\n---\nBeware, you opened the ${appName} app instead of the Celo app. We cannot ensure the safety of using this SDK with ${appName}. USE AT YOUR OWN RISK.\n---\n`
      )
    }
    if (!appConfiguration.arbitraryDataEnabled) {
      console.warn(
        'Beware, your ledger does not allow the use of contract data. Some features may not work correctly, including token transfers. You can enable it from the ledger app settings.'
      )
    }
    return { ...appConfiguration, appName }
  }

  private async retrieveAppName(): Promise<string> {
    //                                                 acl   ins   p1    p2
    const response = await this.ledger!.transport.send(0xb0, 0x01, 0x00, 0x00)
    try {
      const results = [] // (name, version)
      let i = 1
      while (i < response.length + 1) {
        const len = response[i]
        i += 1
        const bufValue = response.subarray(i, i + len)
        i += len
        results.push(bufValue.toString('ascii').trim())
      }

      return results[0]!.toLowerCase()
    } catch (err) {
      console.error('The appName couldnt be infered from the device')
      throw err
    }
  }
}

function validateIndexes(indexes: number[], label: string = 'address index') {
  if (indexes.length === 0) {
    throw new Error(`ledger-wallet: No ${label} provided`)
  }

  const invalidDPs = indexes.some((value) => !(Number.isInteger(value) && value >= 0))
  if (invalidDPs) {
    throw new Error(`ledger-wallet: Invalid ${label} provided`)
  }
}
