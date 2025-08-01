`celocli election`
==================

Participate in and view the state of Validator Elections

* [`celocli election:activate`](#celocli-electionactivate)
* [`celocli election:current`](#celocli-electioncurrent)
* [`celocli election:list`](#celocli-electionlist)
* [`celocli election:revoke`](#celocli-electionrevoke)
* [`celocli election:run`](#celocli-electionrun)
* [`celocli election:show ARG1`](#celocli-electionshow-arg1)
* [`celocli election:vote`](#celocli-electionvote)

## `celocli election:activate`

Activate pending votes in validator elections to begin earning rewards. To earn rewards as a voter, it is required to activate your pending votes at some point after the end of the epoch in which they were made.

```
USAGE
  $ celocli election:activate --from 0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d [-k
    <value> | --useLedger | ] [-n <value>] [--gasCurrency
    0x1234567890123456789012345678901234567890] [--ledgerAddresses <value> ]
    [--ledgerLiveMode ] [--globalHelp] [--for
    0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d] [--wait]

FLAGS
  -k, --privateKey=<value>
      Use a private key to sign local transactions with

  -n, --node=<value>
      URL of the node to run commands against or an alias

  --for=0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d
      Optional: use this to activate votes for another address

  --from=0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d
      (required) Address sending transaction (and voter's address if --for not specified)

  --gasCurrency=0x1234567890123456789012345678901234567890
      Use a specific gas currency for transaction fees (defaults to CELO if no gas
      currency is supplied). It must be a whitelisted token.

  --globalHelp
      View all available global flags

  --ledgerAddresses=<value>
      [default: 1] If --useLedger is set, this will get the first N addresses for local
      signing

  --ledgerLiveMode
      When set, the 4th postion of the derivation path will be iterated over instead of
      the 5th. This is useful to use same address on you Ledger with celocli as you do on
      Ledger Live

  --useLedger
      Set it to use a ledger wallet

  --wait
      Wait until all pending votes can be activated

DESCRIPTION
  Activate pending votes in validator elections to begin earning rewards. To earn
  rewards as a voter, it is required to activate your pending votes at some point after
  the end of the epoch in which they were made.

EXAMPLES
  activate --from 0x4443d0349e8b3075cba511a0a87796597602a0f1

  activate --from 0x4443d0349e8b3075cba511a0a87796597602a0f1 --for 0x5409ed021d9299bf6814279a6a1411a7e866a631

  activate --from 0x4443d0349e8b3075cba511a0a87796597602a0f1 --wait

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/activate.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/activate.js)_

## `celocli election:current`

Outputs the set of rpc nodes currently elected. An election is run to select the community rpc node set at the end of every epoch.

```
USAGE
  $ celocli election:current [-k <value> | --useLedger | ] [-n <value>] [--gasCurrency
    0x1234567890123456789012345678901234567890] [--ledgerAddresses <value> ]
    [--ledgerLiveMode ] [--globalHelp] [--valset] [--columns <value> | -x] [--filter
    <value>] [--no-header | [--csv | --no-truncate]] [--output csv|json|yaml |  | ]
    [--sort <value>]

FLAGS
  -k, --privateKey=<value>
      Use a private key to sign local transactions with

  -n, --node=<value>
      URL of the node to run commands against or an alias

  -x, --extended
      show extra columns

  --columns=<value>
      only show provided columns (comma-separated)

  --csv
      output is csv format [alias: --output=csv]

  --filter=<value>
      filter property by partial string matching, ex: name=foo

  --gasCurrency=0x1234567890123456789012345678901234567890
      Use a specific gas currency for transaction fees (defaults to CELO if no gas
      currency is supplied). It must be a whitelisted token.

  --globalHelp
      View all available global flags

  --ledgerAddresses=<value>
      [default: 1] If --useLedger is set, this will get the first N addresses for local
      signing

  --ledgerLiveMode
      When set, the 4th postion of the derivation path will be iterated over instead of
      the 5th. This is useful to use same address on you Ledger with celocli as you do on
      Ledger Live

  --no-header
      hide table header from output

  --no-truncate
      do not truncate output to fit screen

  --output=<option>
      output in a more machine friendly format
      <options: csv|json|yaml>

  --sort=<value>
      property to sort by (prepend '-' for descending)

  --useLedger
      Set it to use a ledger wallet

  --valset
      Show currently used signers from valset (by default the authorized validator signers
      are shown). Useful for checking if keys have been rotated.

DESCRIPTION
  Outputs the set of rpc nodes currently elected. An election is run to select the
  community rpc node set at the end of every epoch.

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/current.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/current.js)_

## `celocli election:list`

Prints the list of validator groups, the number of votes they have received, the number of additional votes they are able to receive, and whether or not they are eligible to elect validators.

```
USAGE
  $ celocli election:list [-n <value>] [--globalHelp] [--columns <value> | -x]
    [--filter <value>] [--no-header | [--csv | --no-truncate]] [--output csv|json|yaml |
    | ] [--sort <value>]

FLAGS
  -n, --node=<value>     URL of the node to run commands against or an alias
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --csv              output is csv format [alias: --output=csv]
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --globalHelp       View all available global flags
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  output in a more machine friendly format
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  Prints the list of validator groups, the number of votes they have received, the
  number of additional votes they are able to receive, and whether or not they are
  eligible to elect validators.

EXAMPLES
  list

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/list.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/list.js)_

## `celocli election:revoke`

Revoke votes for a Validator Group in validator elections.

```
USAGE
  $ celocli election:revoke --from 0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d --for
    0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d --value <value> [-k <value> | --useLedger
    | ] [-n <value>] [--gasCurrency 0x1234567890123456789012345678901234567890]
    [--ledgerAddresses <value> ] [--ledgerLiveMode ] [--globalHelp]

FLAGS
  -k, --privateKey=<value>
      Use a private key to sign local transactions with

  -n, --node=<value>
      URL of the node to run commands against or an alias

  --for=0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d
      (required) ValidatorGroup's address

  --from=0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d
      (required) Voter's address

  --gasCurrency=0x1234567890123456789012345678901234567890
      Use a specific gas currency for transaction fees (defaults to CELO if no gas
      currency is supplied). It must be a whitelisted token.

  --globalHelp
      View all available global flags

  --ledgerAddresses=<value>
      [default: 1] If --useLedger is set, this will get the first N addresses for local
      signing

  --ledgerLiveMode
      When set, the 4th postion of the derivation path will be iterated over instead of
      the 5th. This is useful to use same address on you Ledger with celocli as you do on
      Ledger Live

  --useLedger
      Set it to use a ledger wallet

  --value=<value>
      (required) Value of votes to revoke

DESCRIPTION
  Revoke votes for a Validator Group in validator elections.

EXAMPLES
  revoke --from 0x4443d0349e8b3075cba511a0a87796597602a0f1 --for 0x932fee04521f5fcb21949041bf161917da3f588b, --value 1000000

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/revoke.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/revoke.js)_

## `celocli election:run`

Runs a "mock" election and prints out the validators that would be elected if the epoch ended right now.

```
USAGE
  $ celocli election:run [-n <value>] [--globalHelp] [--columns <value> | -x]
    [--filter <value>] [--no-header | [--csv | --no-truncate]] [--output csv|json|yaml |
    | ] [--sort <value>]

FLAGS
  -n, --node=<value>     URL of the node to run commands against or an alias
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --csv              output is csv format [alias: --output=csv]
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --globalHelp       View all available global flags
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  output in a more machine friendly format
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  Runs a "mock" election and prints out the validators that would be elected if the
  epoch ended right now.

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/run.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/run.js)_

## `celocli election:show ARG1`

Show election information about a voter or registered Validator Group

```
USAGE
  $ celocli election:show ARG1 [-n <value>] [--globalHelp] [--voter | --group]

ARGUMENTS
  ARG1  Voter or Validator Groups's address

FLAGS
  -n, --node=<value>  URL of the node to run commands against or an alias
      --globalHelp    View all available global flags
      --group         Show information about a group running in Validator elections
      --voter         Show information about an account voting in Validator elections

DESCRIPTION
  Show election information about a voter or registered Validator Group

EXAMPLES
  show 0x97f7333c51897469E8D98E7af8653aAb468050a3 --voter

  show 0x97f7333c51897469E8D98E7af8653aAb468050a3 --group

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/show.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/show.js)_

## `celocli election:vote`

Vote for a Validator Group in elections.

```
USAGE
  $ celocli election:vote --from 0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d --for
    0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d --value 10000000000000000000000 [-k
    <value> | --useLedger | ] [-n <value>] [--gasCurrency
    0x1234567890123456789012345678901234567890] [--ledgerAddresses <value> ]
    [--ledgerLiveMode ] [--globalHelp]

FLAGS
  -k, --privateKey=<value>
      Use a private key to sign local transactions with

  -n, --node=<value>
      URL of the node to run commands against or an alias

  --for=0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d
      (required) ValidatorGroup's address

  --from=0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d
      (required) Voter's address

  --gasCurrency=0x1234567890123456789012345678901234567890
      Use a specific gas currency for transaction fees (defaults to CELO if no gas
      currency is supplied). It must be a whitelisted token.

  --globalHelp
      View all available global flags

  --ledgerAddresses=<value>
      [default: 1] If --useLedger is set, this will get the first N addresses for local
      signing

  --ledgerLiveMode
      When set, the 4th postion of the derivation path will be iterated over instead of
      the 5th. This is useful to use same address on you Ledger with celocli as you do on
      Ledger Live

  --useLedger
      Set it to use a ledger wallet

  --value=10000000000000000000000
      (required) Amount of CELO used to vote for group

DESCRIPTION
  Vote for a Validator Group in elections.

EXAMPLES
  vote --from 0x4443d0349e8b3075cba511a0a87796597602a0f1 --for 0x932fee04521f5fcb21949041bf161917da3f588b, --value 1000000

FLAG DESCRIPTIONS
  -n, --node=<value>  URL of the node to run commands against or an alias

    Can be a full url like https://forno.celo.org or an alias. default:
    http://localhost:8545
    Alias options:
    local, localhost => 'http://localhost:8545'
    alfajores => Celo Alfajores Testnet,
    mainnet, celo, forno => Celo Mainnet chain',
```

_See code: [lib/commands/election/vote.js](https://github.com/celo-org/developer-tooling/tree/%40celo/celocli%407.0.1/packages/cli/lib/commands/election/vote.js)_
