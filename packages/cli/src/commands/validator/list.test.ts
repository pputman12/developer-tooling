import { testWithAnvilL2 } from '@celo/dev-utils/anvil-test'
import { addressToPublicKey } from '@celo/utils/lib/signatureUtils'
import { ux } from '@oclif/core'
import Web3 from 'web3'
import { stripAnsiCodesFromNestedArray, testLocallyWithWeb3Node } from '../../test-utils/cliUtils'
import Register from '../account/register'
import Lock from '../lockedcelo/lock'
import ListValidators from './list'
import ValidatorRegister from './register'

process.env.NO_SYNCCHECK = 'true'

testWithAnvilL2('validator:list', (web3: Web3) => {
  let account: string
  let ecdsaPublicKey: string
  const writeMock = jest.spyOn(ux.write, 'stdout').mockImplementation(() => {
    // noop
  })

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {
      // noop
    })
    const accounts = await web3.eth.getAccounts()
    account = accounts[0]
    ecdsaPublicKey = await addressToPublicKey(account, web3.eth.sign)
    await testLocallyWithWeb3Node(Register, ['--from', account], web3)
    await testLocallyWithWeb3Node(
      Lock,
      ['--from', account, '--value', '10000000000000000000000'],
      web3
    )
    await testLocallyWithWeb3Node(
      ValidatorRegister,
      ['--from', account, '--ecdsaKey', ecdsaPublicKey, '--yes'],
      web3
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
    jest.clearAllMocks()
  })

  it('shows all registered validators', async () => {
    await testLocallyWithWeb3Node(ListValidators, ['--csv'], web3)
    expect(stripAnsiCodesFromNestedArray(writeMock.mock.calls)).toMatchInlineSnapshot(`
      [
        [
          "Address,Name,Affiliation,Score,Ecdsapublickey,Signer
      ",
        ],
        [
          "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65,,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,1.00,0xbf6ee64a8d2fdc551ec8bb9ef862ef6b4bcb1805cdc520c3aa5866c0575fd3b514c5562c3caae7aec5cd6f144b57135c75b6f6cea059c3d08d1f39a9c227219d,0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
      ",
        ],
        [
          "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc,,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,1.00,0x37b84de6947b243626cc8b977bb1f1632610614842468dfa8f35dcbbc55a515e47f6fe259cffc671a719eaef444a0d689b16a90051985a13661840cf5e221503,0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
      ",
        ],
        [
          "0x976EA74026E726554dB657fA54763abd0C3a0aa9,,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,1.00,0x9a4ab212cb92775d227af4237c20b81f4221e9361d29007dfc16c79186b577cb6ba3f1b582ad0b5572c93f47e7506d66df7f2af05fa1828de0e511aac7b97828,0x976EA74026E726554dB657fA54763abd0C3a0aa9
      ",
        ],
        [
          "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955,,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,1.00,0x01f2bf1fa920e77a43c7aec2587d0b3814093420cc59a9b3ad66dd5734dda7be6f8b7de790eac3a720fd8e4bcb9eae9434f843d3cec111d9e07adeddeae090f2,0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
      ",
        ],
        [
          "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f,,0x90F79bf6EB2c4f870365E785982E1f101E93b906,1.00,0x931e7fda8da226f799f791eefc9afebcd7ae2b1b19a03c5eaa8d72122d9fe74d887a3962ff861190b531ab31ee82f0d7f255dfe3ab73ca627bd70ab3d1cbb417,0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f
      ",
        ],
        [
          "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720,,0x90F79bf6EB2c4f870365E785982E1f101E93b906,1.00,0x3255458e24278e31d5940f304b16300fdff3f6efd3e2a030b5818310ac67af45e28d057e6a332d07e0c5ab09d6947fd4eed1a646edbf224e2d2fec6f49f90abc,0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
      ",
        ],
        [
          "0x5409ED021D9299bf6814279A6A1411A7e866A631,,0x0000000000000000000000000000000000000000,1.00,0x3629fc8f36ca627049dcf4de8a89b3bbc93284e673e814eb50eeeefecd20c4f57c9228f66fae690b6be7dedd04a531ceb49028305633e4e58265518c1e82f06f,0x5409ED021D9299bf6814279A6A1411A7e866A631
      ",
        ],
      ]
    `)
  })
})
