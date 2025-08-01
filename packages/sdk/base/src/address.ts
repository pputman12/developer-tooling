const HEX_REGEX = /^0x[0-9A-F]*$/i

export type Address = string

export type StrongAddress = `0x${string}`

export const eqAddress = (a: Address, b: Address) => normalizeAddress(a) === normalizeAddress(b)

export const normalizeAddress = (a: Address) => trimLeading0x(a).toLowerCase()

export const isNullAddress = (a: Address) => normalizeAddress(a) === normalizeAddress(NULL_ADDRESS)

export const normalizeAddressWith0x = (a: Address) =>
  ensureLeading0x(a).toLowerCase() as StrongAddress

export const trimLeading0x = (input: string) => (input.startsWith('0x') ? input.slice(2) : input)

export const ensureLeading0x = (input: string): StrongAddress =>
  input.startsWith('0x') ? (input as StrongAddress) : (`0x${input}` as const)

// Turns '0xce10ce10ce10ce10ce10ce10ce10ce10ce10ce10'
// into ['ce10','ce10','ce10','ce10','ce10','ce10','ce10','ce10','ce10','ce10']
export const getAddressChunks = (input: string): string[] =>
  trimLeading0x(input).match(/.{1,4}/g) || []

export const isHexString = (input: string): input is StrongAddress => HEX_REGEX.test(input)

export const hexToBuffer = (input: string) => Buffer.from(trimLeading0x(input), 'hex')

export const bufferToHex = (buf: Buffer) => ensureLeading0x(buf.toString('hex'))

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000' as StrongAddress

export const findAddressIndex = (address: Address, addresses: Address[]) =>
  addresses.findIndex((x) => eqAddress(x, address))

// Returns an array of indices mapping the entries of oldAddress[] to newAddress[]
export const mapAddressListOnto = (oldAddress: Address[], newAddress: Address[]) => {
  const oldAddressIndex: {
    address: Address
    index: number
  }[] = oldAddress.map((x: Address, index: number) => ({ address: normalizeAddress(x), index }))

  const newAddressIndex: {
    address: Address
    index: number
  }[] = newAddress.map((x: Address, index: number) => ({ address: normalizeAddress(x), index }))

  oldAddressIndex.sort((a, b) => a.address.localeCompare(b.address))
  newAddressIndex.sort((a, b) => a.address.localeCompare(b.address))
  const res = [...new Array(oldAddress.length).fill(-1)]

  for (let i = 0, j = 0; i < oldAddress.length && j < newAddress.length; ) {
    const cmp = oldAddressIndex[i].address.localeCompare(newAddressIndex[j].address)
    if (cmp < 0) {
      i++
    } else if (cmp > 0) {
      j++
    } else {
      // Address is present in both lists
      res[oldAddressIndex[i].index] = newAddressIndex[j].index
      i++
      j++
    }
  }
  return res
}

// Returns data[] reordered by mapAddressListOnto(), and initiaValue for any entry of
// oldAddress[] not present in newAddress[].
export function mapAddressListDataOnto<T>(
  data: T[],
  oldAddress: Address[],
  newAddress: Address[],
  initialValue: T
): T[] {
  const res = [...new Array(oldAddress.length).fill(initialValue)]
  if (data.length === 0) {
    return res
  }
  const addressIndexMap = mapAddressListOnto(oldAddress, newAddress)
  for (let i = 0; i < addressIndexMap.length; i++) {
    if (addressIndexMap[i] >= 0) {
      res[addressIndexMap[i]] = data[i]
    }
  }
  return res
}
