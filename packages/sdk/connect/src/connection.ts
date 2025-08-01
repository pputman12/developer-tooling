// tslint:disable: ordered-imports
import { StrongAddress } from '@celo/base'
import { ensureLeading0x, toChecksumAddress } from '@celo/utils/lib/address'
import { EIP712TypedData, generateTypedDataHash } from '@celo/utils/lib/sign-typed-data-utils'
import { Signature, parseSignatureWithoutPrefix } from '@celo/utils/lib/signatureUtils'
import { bufferToHex } from '@ethereumjs/util'
import debugFactory from 'debug'
import Web3 from 'web3'
import { AbiCoder } from './abi-types'
import { CeloProvider, assertIsCeloProvider } from './celo-provider'
import {
  Address,
  Block,
  BlockHeader,
  BlockNumber,
  CeloTx,
  CeloTxObject,
  CeloTxPending,
  CeloTxReceipt,
  Provider,
  Syncing,
} from './types'
import { decodeStringParameter } from './utils/abi-utils'
import {
  hexToNumber,
  inputAddressFormatter,
  inputBlockNumberFormatter,
  inputDefaultBlockNumberFormatter,
  inputSignFormatter,
  outputBigNumberFormatter,
  outputBlockFormatter,
  outputBlockHeaderFormatter,
  outputCeloTxFormatter,
  outputCeloTxReceiptFormatter,
} from './utils/formatter'
import { hasProperty } from './utils/provider-utils'
import { HttpRpcCaller, RpcCaller, getRandomId } from './utils/rpc-caller'
import { TxParamsNormalizer } from './utils/tx-params-normalizer'
import { TransactionResult, toTxResult } from './utils/tx-result'
import { ReadOnlyWallet } from './wallet'

const debugGasEstimation = debugFactory('connection:gas-estimation')

type BN = ReturnType<Web3['utils']['toBN']>
export interface ConnectionOptions {
  gasInflationFactor: number
  feeCurrency?: StrongAddress
  from?: StrongAddress
}

/**
 * Connection is a Class for connecting to Celo, sending Transactions, etc
 * @param web3 an instance of web3
 * @param wallet a child class of {@link WalletBase}
 * @param handleRevert sets handleRevert on the web3.eth instance passed in
 */
export class Connection {
  private config: ConnectionOptions
  private _chainID: number | undefined
  readonly paramsPopulator: TxParamsNormalizer
  rpcCaller!: RpcCaller

  constructor(
    readonly web3: Web3,
    public wallet?: ReadOnlyWallet,
    handleRevert = true
  ) {
    web3.eth.handleRevert = handleRevert

    this.config = {
      gasInflationFactor: 1.3,
    }

    const existingProvider: Provider = web3.currentProvider as Provider
    this.setProvider(existingProvider)
    // TODO: Add this line with the wallets separation completed
    // this.wallet = _wallet ?? new LocalWallet()
    this.config.from = (web3.eth.defaultAccount as StrongAddress) ?? undefined
    this.paramsPopulator = new TxParamsNormalizer(this)
  }

  setProvider(provider: Provider) {
    if (!provider) {
      throw new Error('Must have a valid Provider')
    }
    this._chainID = undefined
    try {
      if (!(provider instanceof CeloProvider)) {
        this.rpcCaller = new HttpRpcCaller(provider)
        provider = new CeloProvider(provider, this)
      }
      this.web3.setProvider(provider as any)
      return true
    } catch (error) {
      console.error(`could not attach provider`, error)
      return false
    }
  }

  keccak256 = (value: string | BN): string => {
    return this.web3.utils.keccak256(value)
  }

  hexToAscii = (hex: string) => {
    return this.web3.utils.hexToAscii(hex)
  }

  /**
   * Set default account for generated transactions (eg. tx.from )
   */
  set defaultAccount(address: StrongAddress | undefined) {
    this.config.from = address
    this.web3.eth.defaultAccount = address ? address : null
  }

  /**
   * Default account for generated transactions (eg. tx.from)
   */
  get defaultAccount(): StrongAddress | undefined {
    return this.config.from
  }

  set defaultGasInflationFactor(factor: number) {
    this.config.gasInflationFactor = factor
  }

  get defaultGasInflationFactor() {
    return this.config.gasInflationFactor
  }

  /**
   * Set the ERC20 address for the token to use to pay for transaction fees.
   * The ERC20 address SHOULD be whitelisted for gas, but this is not checked or enforced.
   *
   * Set to `null` to use CELO
   *
   * @param address ERC20 address
   */
  set defaultFeeCurrency(address: StrongAddress | undefined) {
    this.config.feeCurrency = address
  }

  get defaultFeeCurrency() {
    return this.config.feeCurrency
  }

  isLocalAccount(address?: StrongAddress): boolean {
    return this.wallet != null && this.wallet.hasAccount(address)
  }

  addAccount(privateKey: string) {
    if (this.wallet) {
      if (hasProperty<{ addAccount: (privateKey: string) => void }>(this.wallet, 'addAccount')) {
        this.wallet.addAccount(privateKey)
      } else {
        throw new Error("The wallet used, can't add accounts")
      }
    } else {
      throw new Error('No wallet set')
    }
  }

  removeAccount(address: string) {
    if (this.wallet) {
      if (hasProperty<{ removeAccount: (address: string) => void }>(this.wallet, 'removeAccount')) {
        this.wallet.removeAccount(address)
      } else {
        throw new Error("The wallet used, can't remove accounts")
      }
    } else {
      throw new Error('No wallet set')
    }
  }

  async getNodeAccounts(): Promise<StrongAddress[]> {
    const nodeAccountsResp = await this.rpcCaller.call('eth_accounts', [])
    return this.toChecksumAddresses(nodeAccountsResp.result ?? []) as StrongAddress[]
  }

  getLocalAccounts(): StrongAddress[] {
    return this.wallet
      ? (this.toChecksumAddresses(this.wallet.getAccounts()) as StrongAddress[])
      : []
  }

  async getAccounts(): Promise<StrongAddress[]> {
    return (await this.getNodeAccounts()).concat(this.getLocalAccounts()) as StrongAddress[]
  }

  private toChecksumAddresses(addresses: string[]) {
    return addresses.map((value) => toChecksumAddress(value))
  }

  isListening(): Promise<boolean> {
    return this.web3.eth.net.isListening()
  }

  isSyncing(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.web3.eth
        .isSyncing()
        .then((response: boolean | Syncing) => {
          // isSyncing returns a syncProgress object when it's still syncing
          if (typeof response === 'boolean') {
            resolve(response)
          } else {
            resolve(true)
          }
        })
        .catch(reject)
    })
  }

  /**
   * Send a transaction to celo-blockchain.
   *
   * Similar to `web3.eth.sendTransaction()` but with following differences:
   *  - applies connections tx's defaults
   *  - estimatesGas before sending
   *  - returns a `TransactionResult` instead of `PromiEvent`
   */
  sendTransaction = async (tx: CeloTx): Promise<TransactionResult> => {
    tx = this.fillTxDefaults(tx)

    let gas = tx.gas
    if (gas == null) {
      gas = await this.estimateGasWithInflationFactor(tx)
    }

    return toTxResult(
      this.web3.eth.sendTransaction({
        ...tx,
        gas,
      })
    )
  }

  sendTransactionObject = async (
    txObj: CeloTxObject<any>,
    tx?: Omit<CeloTx, 'data'>
  ): Promise<TransactionResult> => {
    tx = this.fillTxDefaults(tx)

    let gas = tx.gas
    if (gas == null) {
      const gasEstimator = (_tx: CeloTx) => txObj.estimateGas({ ..._tx })
      const getCallTx = (_tx: CeloTx) => {
        // @ts-ignore missing _parent property from TransactionObject type.
        return { ..._tx, data: txObj.encodeABI(), to: txObj._parent._address }
      }
      const caller = (_tx: CeloTx) => this.web3.eth.call(getCallTx(_tx))
      gas = await this.estimateGasWithInflationFactor(tx, gasEstimator, caller)
    }

    return toTxResult(
      txObj.send({
        ...tx,
        gas,
      })
    )
  }

  /*
   * @param signer - The address of account signing this data
   * @param typedData - Structured data to be signed
   * @param version - Optionally provide a version which will be appended to the method. E.G. (4) becomes 'eth_signTypedData_v4'
   * @remarks Some providers like Metamask treat eth_signTypedData differently from versioned method eth_signTypedData_v4
   * @see [Metamask info in signing Typed Data](https://docs.metamask.io/guide/signing-data.html)
   */
  signTypedData = async (
    signer: string,
    typedData: EIP712TypedData,
    version: 1 | 3 | 4 | 5 | null = 4
  ): Promise<Signature> => {
    // stringify data for v3 & v4 based on https://github.com/MetaMask/metamask-extension/blob/c72199a1a6e4151c40c22f79d0f3b6ed7a2d59a7/app/scripts/lib/typed-message-manager.js#L185
    const shouldStringify = version === 3 || version === 4

    // Uses the Provider and not the RpcCaller, because this method should be intercepted
    // by the CeloProvider if there is a local wallet that could sign it. The RpcCaller
    // would just forward it to the node
    const signature = await new Promise<string>((resolve, reject) => {
      const method = version ? `eth_signTypedData_v${version}` : 'eth_signTypedData'
      ;(this.web3.currentProvider as Provider).send(
        {
          id: getRandomId(),
          jsonrpc: '2.0',
          method,
          params: [
            inputAddressFormatter(signer),
            shouldStringify ? JSON.stringify(typedData) : typedData,
          ],
        },
        (error, resp) => {
          if (error) {
            reject(error)
          } else if (resp) {
            resolve(resp.result as string)
          } else {
            reject(new Error('empty-response'))
          }
        }
      )
    })

    const messageHash = bufferToHex(generateTypedDataHash(typedData))
    return parseSignatureWithoutPrefix(messageHash, signature, signer)
  }

  sign = async (dataToSign: string, address: Address | number): Promise<string> => {
    // Uses the Provider and not the RpcCaller, because this method should be intercepted
    // by the CeloProvider if there is a local wallet that could sign it. The RpcCaller
    // would just forward it to the node
    const signature = await new Promise<string>((resolve, reject) => {
      ;(this.web3.currentProvider as Provider).send(
        {
          id: getRandomId(),
          jsonrpc: '2.0',
          method: 'eth_sign',
          params: [inputAddressFormatter(address.toString()), inputSignFormatter(dataToSign)],
        },
        (error, resp) => {
          if (error) {
            reject(error)
          } else if (resp) {
            resolve(resp.result as string)
          } else {
            reject(new Error('empty-response'))
          }
        }
      )
    })

    return signature
  }

  sendSignedTransaction = async (signedTransactionData: string): Promise<TransactionResult> => {
    return toTxResult(this.web3.eth.sendSignedTransaction(signedTransactionData))
  }
  // if neither gas price nor feeMarket fields are present set them.
  setFeeMarketGas = async (tx: CeloTx): Promise<CeloTx> => {
    if (isEmpty(tx.maxPriorityFeePerGas)) {
      tx.maxPriorityFeePerGas = await this.getMaxPriorityFeePerGas(tx.feeCurrency)
    }

    if (isEmpty(tx.maxFeePerGas)) {
      const baseFee = isEmpty(tx.feeCurrency)
        ? await this.getBlock('latest').then((block) => block.baseFeePerGas)
        : await this.gasPrice(tx.feeCurrency)
      const withBuffer = addBufferToBaseFee(BigInt(baseFee!))
      const maxFeePerGas =
        withBuffer + BigInt(ensureLeading0x(tx.maxPriorityFeePerGas.toString(16)))
      tx.maxFeePerGas = ensureLeading0x(maxFeePerGas.toString(16))
    }

    return {
      ...tx,
      gasPrice: undefined,
    }
  }

  estimateGas = async (
    tx: CeloTx,
    gasEstimator: (tx: CeloTx) => Promise<number> = this.web3.eth.estimateGas,
    caller: (tx: CeloTx) => Promise<string> = this.web3.eth.call
  ): Promise<number> => {
    try {
      const gas = await gasEstimator({ ...tx })
      debugGasEstimation('estimatedGas: %s', gas.toString())
      return gas
    } catch (e) {
      const called = await caller({ data: tx.data, to: tx.to, from: tx.from })
      let revertReason = 'Could not decode transaction failure reason'
      if (called.startsWith('0x08c379a')) {
        revertReason = decodeStringParameter(this.getAbiCoder(), called.substring(10))
      }
      debugGasEstimation('Recover transaction failure reason', {
        called,
        data: tx.data,
        to: tx.to,
        from: tx.from,
        error: e,
        revertReason,
      })
      return Promise.reject(`Gas estimation failed: ${revertReason} or ${e}`)
    }
  }

  getAbiCoder(): AbiCoder {
    return this.web3.eth.abi as unknown as AbiCoder
  }

  estimateGasWithInflationFactor = async (
    tx: CeloTx,
    gasEstimator?: (tx: CeloTx) => Promise<number>,
    caller?: (tx: CeloTx) => Promise<string>
  ): Promise<number> => {
    try {
      const gas = Math.round(
        (await this.estimateGas(tx, gasEstimator, caller)) * this.config.gasInflationFactor
      )
      debugGasEstimation('estimatedGasWithInflationFactor: %s', gas)
      return gas
    } catch (e: any) {
      throw new Error(e)
    }
  }

  // An instance of Connection will only change chain id if provider is changed.
  chainId = async (): Promise<number> => {
    if (this._chainID) {
      return this._chainID
    }
    // Reference: https://eth.wiki/json-rpc/API#net_version
    const response = await this.rpcCaller.call('net_version', [])
    const chainID = parseInt(response.result.toString(), 10)
    this._chainID = chainID
    return chainID
  }

  getTransactionCount = async (address: Address): Promise<number> => {
    // Reference: https://eth.wiki/json-rpc/API#eth_gettransactioncount
    const response = await this.rpcCaller.call('eth_getTransactionCount', [address, 'pending'])

    return hexToNumber(response.result)!
  }

  nonce = async (address: Address): Promise<number> => {
    return this.getTransactionCount(address)
  }

  coinbase = async (): Promise<string> => {
    // Reference: https://eth.wiki/json-rpc/API#eth_coinbase
    const response = await this.rpcCaller.call('eth_coinbase', [])
    return response.result.toString()
  }

  gasPrice = async (feeCurrency?: Address): Promise<string> => {
    // Required otherwise is not backward compatible
    const parameter = feeCurrency ? [feeCurrency] : []
    // Reference: https://eth.wiki/json-rpc/API#eth_gasprice
    const response = await this.rpcCaller.call('eth_gasPrice', parameter)
    const gasPriceInHex = response.result.toString()
    return gasPriceInHex
  }

  getMaxPriorityFeePerGas = async (feeCurrency?: Address): Promise<string> => {
    const parameter = feeCurrency ? [feeCurrency] : []
    return this.rpcCaller.call('eth_maxPriorityFeePerGas', parameter).then((rpcResponse) => {
      return rpcResponse.result
    })
  }

  getBlockNumber = async (): Promise<number> => {
    const response = await this.rpcCaller.call('eth_blockNumber', [])

    return hexToNumber(response.result)!
  }

  private isBlockNumberHash = (blockNumber: BlockNumber) =>
    blockNumber instanceof String && blockNumber.indexOf('0x') === 0

  getBlock = async (blockHashOrBlockNumber: BlockNumber, fullTxObjects = true): Promise<Block> => {
    const endpoint = this.isBlockNumberHash(blockHashOrBlockNumber)
      ? 'eth_getBlockByHash' // Reference: https://eth.wiki/json-rpc/API#eth_getBlockByHash
      : 'eth_getBlockByNumber' // Reference: https://eth.wiki/json-rpc/API#eth_getBlockByNumber

    const response = await this.rpcCaller.call(endpoint, [
      inputBlockNumberFormatter(blockHashOrBlockNumber),
      fullTxObjects,
    ])

    return outputBlockFormatter(response.result)
  }

  getBlockHeader = async (blockHashOrBlockNumber: BlockNumber): Promise<BlockHeader> => {
    const endpoint = this.isBlockNumberHash(blockHashOrBlockNumber)
      ? 'eth_getHeaderByHash'
      : 'eth_getHeaderByNumber'

    const response = await this.rpcCaller.call(endpoint, [
      inputBlockNumberFormatter(blockHashOrBlockNumber),
    ])

    return outputBlockHeaderFormatter(response.result)
  }

  getBalance = async (address: Address, defaultBlock?: BlockNumber): Promise<string> => {
    // Reference: https://eth.wiki/json-rpc/API#eth_getBalance
    const response = await this.rpcCaller.call('eth_getBalance', [
      inputAddressFormatter(address),
      inputDefaultBlockNumberFormatter(defaultBlock),
    ])
    return outputBigNumberFormatter(response.result)
  }

  getTransaction = async (transactionHash: string): Promise<CeloTxPending> => {
    // Reference: https://eth.wiki/json-rpc/API#eth_getTransactionByHash
    const response = await this.rpcCaller.call('eth_getTransactionByHash', [
      ensureLeading0x(transactionHash),
    ])
    return outputCeloTxFormatter(response.result)
  }

  getTransactionReceipt = async (txhash: string): Promise<CeloTxReceipt | null> => {
    // Reference: https://eth.wiki/json-rpc/API#eth_getTransactionReceipt
    const response = await this.rpcCaller.call('eth_getTransactionReceipt', [
      ensureLeading0x(txhash),
    ])

    if (response.result === null) {
      return null
    }

    return outputCeloTxReceiptFormatter(response.result)
  }

  private fillTxDefaults(tx?: CeloTx): CeloTx {
    const defaultTx: CeloTx = {
      from: this.config.from,
      feeCurrency: this.config.feeCurrency,
    }

    return {
      ...defaultTx,
      ...tx,
    }
  }

  stop() {
    assertIsCeloProvider(this.web3.currentProvider)
    this.web3.currentProvider.stop()
  }
}

const addBufferToBaseFee = (gasPrice: bigint) => (gasPrice * BigInt(120)) / BigInt(100)

function isEmpty(value: string | undefined | number | BN | bigint): value is undefined {
  return (
    value === 0 ||
    value === undefined ||
    value === null ||
    value === '0' ||
    value === BigInt(0) ||
    (typeof value === 'string' &&
      (value.toLowerCase() === '0x' || value.toLowerCase() === '0x0')) ||
    Web3.utils.toBN(value.toString(10)).eq(Web3.utils.toBN(0))
  )
}
export function isPresent(
  value: string | undefined | number | BN | bigint
): value is string | number | BN | bigint {
  return !isEmpty(value)
}
