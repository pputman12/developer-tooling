import { lockedGoldABI } from '@celo/abis'
import { getContract, GetContractReturnType } from 'viem'
import { Clients } from '../client.js'
import { resolveAddress } from './registry.js'

export async function getLockedCeloContract<T extends Clients = Clients>(
  clients: T
): Promise<LockedCeloContract<T>> {
  return getContract({
    address: await resolveAddress(clients.public, 'LockedGold'),
    abi: lockedGoldABI,
    client: clients,
  })
}
export type LockedCeloContract<T extends Clients = Clients> = GetContractReturnType<
  typeof lockedGoldABI,
  T
>
