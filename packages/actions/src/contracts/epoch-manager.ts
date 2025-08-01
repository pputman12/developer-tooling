import { epochManagerABI } from '@celo/abis'
import { getContract, GetContractReturnType } from 'viem'
import { Clients } from '../client.js'
import { resolveAddress } from './registry.js'

export type EpochManager<T extends Clients = Clients> = GetContractReturnType<
  typeof epochManagerABI,
  T
>

export async function getEpochManagerContract<T extends Clients = Clients>(
  clients: T
): Promise<EpochManager<T>> {
  return getContract({
    address: await resolveAddress(clients.public, 'EpochManager'),
    abi: epochManagerABI,
    client: clients,
  })
}
