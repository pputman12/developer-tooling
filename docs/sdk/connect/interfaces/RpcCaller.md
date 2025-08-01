[**@celo/connect v7.0.0**](../README.md)

***

[@celo/connect](../globals.md) / RpcCaller

# Interface: RpcCaller

Defined in: [packages/sdk/connect/src/utils/rpc-caller.ts:63](https://github.com/celo-org/developer-tooling/blob/master/packages/sdk/connect/src/utils/rpc-caller.ts#L63)

## Properties

### call()

> **call**: (`method`, `params`) => `Promise`\<[`JsonRpcResponse`](JsonRpcResponse.md)\>

Defined in: [packages/sdk/connect/src/utils/rpc-caller.ts:64](https://github.com/celo-org/developer-tooling/blob/master/packages/sdk/connect/src/utils/rpc-caller.ts#L64)

#### Parameters

##### method

`string`

##### params

`any`[]

#### Returns

`Promise`\<[`JsonRpcResponse`](JsonRpcResponse.md)\>

***

### send()

> **send**: (`payload`, `callback`) => `void`

Defined in: [packages/sdk/connect/src/utils/rpc-caller.ts:65](https://github.com/celo-org/developer-tooling/blob/master/packages/sdk/connect/src/utils/rpc-caller.ts#L65)

#### Parameters

##### payload

[`JsonRpcPayload`](JsonRpcPayload.md)

##### callback

(`error`, `result?`) => `void`

#### Returns

`void`
