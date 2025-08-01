import { NULL_ADDRESS, trimLeading0x } from '@celo/base/lib/address'
import { keccak_256 } from '@noble/hashes/sha3'
import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { BigNumber } from 'bignumber.js'
import * as t from 'io-ts'
import coder from 'web3-eth-abi'

export interface EIP712Parameter {
  name: string
  type: string
}

export interface EIP712Types {
  [key: string]: EIP712Parameter[]
}

export interface EIP712TypesWithPrimary {
  types: EIP712Types
  primaryType: string
}

export type EIP712ObjectValue =
  | string
  | number
  | BigNumber
  | boolean
  | Buffer
  | EIP712Object
  | EIP712ObjectValue[]

export interface EIP712Object {
  [key: string]: EIP712ObjectValue
}

export interface EIP712TypedData {
  types: EIP712Types & { EIP712Domain: EIP712Parameter[] }
  domain: EIP712Object
  message: EIP712Object
  primaryType: string
}

/** Array of all EIP-712 atomic type names. */
export const EIP712_ATOMIC_TYPES = [
  'bool',
  'address',
  // bytes types from 1 to 32 bytes
  // and uint/int types from 8 to 256 bits
  ...(() => {
    const result = []
    // Putting "bigger" types first, assuming they are more likely to be used.
    // So `EIP712_ATOMIC_TYPES.includes(...)` calls are faster. (likely useless micro-optimization :D)
    for (let i = 32; i >= 1; i--) {
      result.push('bytes' + i)
      result.push('uint' + i * 8)
      result.push('int' + i * 8)
    }
    return result
  })(),
]

export const EIP712_DYNAMIC_TYPES = ['bytes', 'string']

export const EIP712_BUILTIN_TYPES = EIP712_DYNAMIC_TYPES.concat(EIP712_ATOMIC_TYPES)

// Regular expression used to identify and parse EIP-712 array type strings.
const EIP712_ARRAY_REGEXP = /^(?<memberType>[\w<>\[\]_\-]+)(\[(?<fixedLength>\d+)?\])$/

// Regular expression used to identify EIP-712 integer types (e.g. int256, uint256, uint8).
const EIP712_INT_REGEXP = /^u?int\d*$/

// Regular expression used to identify EIP-712 bytes types (e.g. bytes, bytes1, up to bytes32).
const EIP712_BYTES_REGEXP = /^bytes\d*$/

/**
 * Utility type representing an optional value in a EIP-712 compatible manner, as long as the
 * concrete type T is a subtype of EIP712ObjectValue.
 *
 * @remarks EIP712Optonal is not part of the EIP712 standard, but is fully compatible with it.
 */
export type EIP712Optional<T extends EIP712ObjectValue> = {
  defined: boolean
  value: T
}

/**
 * Utility to build EIP712Optional<T> types to insert in EIP-712 type arrays.
 * @param typeName EIP-712 string type name. Should be builtin or defined in the EIP712Types
 * structure into which this type will be merged.
 */
export const eip712OptionalType = (typeName: string): EIP712Types => ({
  [`Optional<${typeName}>`]: [
    { name: 'defined', type: 'bool' },
    { name: 'value', type: typeName },
  ],
})

/**
 * Utility to build EIP712Optional<T> schemas for encoding and decoding with io-ts.
 * @param schema io-ts type (a.k.a. schema or codec) describing the inner type.
 */
export const eip712OptionalSchema = <S extends t.Mixed>(schema: S) =>
  t.type({
    defined: t.boolean,
    value: schema,
  })

/** Utility to construct an defined EIP712Optional value with inferred type. */
export const defined = <T extends EIP712ObjectValue>(value: T): EIP712Optional<T> => ({
  defined: true,
  value,
})

/** Undefined EIP712Optional type with value type boolean. */
export const noBool: EIP712Optional<boolean> = {
  defined: false,
  value: false,
}

/** Undefined EIP712Optional type with value type number. */
export const noNumber: EIP712Optional<number> = {
  defined: false,
  value: 0,
}

/** Undefined EIP712Optional type with value type string. */
export const noString: EIP712Optional<string> = {
  defined: false,
  value: '',
}

/**
 * Generates the EIP712 Typed Data hash for signing
 * @param   typedData An object that conforms to the EIP712TypedData interface
 * @return  A Buffer containing the hash of the typed data.
 */
export function generateTypedDataHash(typedData: EIP712TypedData): Buffer {
  return Buffer.from(
    keccak_256(
      Buffer.concat([
        Buffer.from('1901', 'hex'),
        structHash('EIP712Domain', typedData.domain, typedData.types),
        structHash(typedData.primaryType, typedData.message, typedData.types),
      ])
    )
  )
}

/**
 * Given the primary type, and dictionary of types, this function assembles a sorted list
 * representing the transitive dependency closure of the primary type. (Inclusive of the primary
 * type itself.)
 */
function findDependencies(primaryType: string, types: EIP712Types, found: string[] = []): string[] {
  // If we have aready found the dependencies of this type, or it is a builtin, return early.
  if (found.includes(primaryType) || EIP712_BUILTIN_TYPES.includes(primaryType)) {
    return []
  }

  // If this is an array type, return the results for its member type.
  if (EIP712_ARRAY_REGEXP.test(primaryType)) {
    const match = EIP712_ARRAY_REGEXP.exec(primaryType)
    const memberType: string = match?.groups?.memberType!
    return findDependencies(memberType, types, found)
  }

  // If this is not a builtin and is not defined, we cannot correctly construct a type encoding.
  if (types[primaryType] === undefined) {
    throw new Error(`Unrecognized type ${primaryType} is not included in the EIP-712 type list`)
  }

  // Execute a depth-first search to populate the (inclusive) dependencies list.
  // By the first invarient of this function, the resulting list should not contain duplicates.
  const dependencies = [primaryType]
  for (const field of types[primaryType]) {
    dependencies.push(...findDependencies(field.type, types, found.concat(dependencies)))
  }
  return dependencies
}

/**
 * Creates a string encoding of the primary type, including all dependencies.
 * E.g. "Transaction(Person from,Person to,Asset tx)Asset(address token,uint256 amount)Person(address wallet,string name)"
 */
export function encodeType(primaryType: string, types: EIP712Types): string {
  let deps = findDependencies(primaryType, types)
  deps = deps.filter((d) => d !== primaryType)
  deps = [primaryType].concat(deps.sort())
  let result = ''
  for (const dep of deps) {
    result += `${dep}(${types[dep].map(({ name, type }) => `${type} ${name}`).join(',')})`
  }
  return result
}

export function typeHash(primaryType: string, types: EIP712Types): Buffer {
  return Buffer.from(keccak_256(utf8ToBytes(encodeType(primaryType, types))))
}

/** Encodes a single EIP-712 value to a 32-byte buffer */
function encodeValue(valueType: string, value: EIP712ObjectValue, types: EIP712Types): Buffer {
  // Encode the atomic types as their corresponding soldity ABI type.
  if (EIP712_ATOMIC_TYPES.includes(valueType)) {
    const hexEncoded = coder.encodeParameter(valueType, normalizeValue(valueType, value))
    return Buffer.from(trimLeading0x(hexEncoded), 'hex')
  }

  // Encode `string` and `bytes` types as their keccak hash.
  if (valueType === 'string') {
    // Converting to Buffer before passing to `keccak` prevents an issue where the string is
    // interpretted as a hex-encoded string when is starts with 0x.
    // https://github.com/ethereumjs/ethereumjs-util/blob/7e3be1d97b4e11fbc4924836b8c444e644f643ac/index.js#L155-L183
    return Buffer.from(keccak_256(Buffer.from(value as string, 'utf8')))
  }
  if (valueType === 'bytes') {
    // Allow the user to use either utf8 (plain string) or hex encoding for their bytes.
    // Note: keccak throws if the value cannot be converted into a Buffer,
    return Buffer.from(keccak_256(hexToBytes(trimLeading0x(value as string))))
  }

  // Encode structs as its hashStruct (e.g. keccak(typeHash || encodeData(struct)) ).
  if (types[valueType] !== undefined) {
    return structHash(valueType, value as EIP712Object, types)
  }

  // Encode arrays as the hash of the concatenated encoding of the underlying types.
  if (EIP712_ARRAY_REGEXP.test(valueType)) {
    // Note: If a fixed length is provided in the type, it is not checked.
    const match = EIP712_ARRAY_REGEXP.exec(valueType)
    const memberType: string = match?.groups?.memberType!
    return Buffer.from(
      keccak_256(
        Buffer.concat(
          (value as EIP712ObjectValue[]).map((member) => encodeValue(memberType, member, types))
        )
      )
    )
  }

  throw new Error(`Unrecognized or unsupported type in EIP-712 encoding: ${valueType}`)
}

function normalizeValue(type: string, value: EIP712ObjectValue): EIP712ObjectValue {
  const normalizedValue =
    EIP712_INT_REGEXP.test(type) && BigNumber.isBigNumber(value) ? value.toString() : value
  return normalizedValue
}

/**
 * Constructs the struct encoding of the data as the primary type.
 */
export function encodeData(primaryType: string, data: EIP712Object, types: EIP712Types): Buffer {
  const fields = types[primaryType]
  if (fields === undefined) {
    throw new Error(`Unrecognized primary type in EIP-712 encoding: ${primaryType}`)
  }

  return Buffer.concat(fields.map((field) => encodeValue(field.type, data[field.name], types)))
}

export function structHash(primaryType: string, data: EIP712Object, types: EIP712Types): Buffer {
  return Buffer.from(
    keccak_256(Buffer.concat([typeHash(primaryType, types), encodeData(primaryType, data, types)]))
  )
}

/**
 * Produce the zero value for a given type.
 *
 * @remarks
 * All atomic types will encode as the 32-byte zero value. Dynamic types as an empty hash.
 * Dynamic arrays will return an empty array. Fixed length arrays will have members set to zero.
 * Structs will have the values of all fields set to zero recursively.
 *
 * Note that EIP-712 does not specify zero values, and so this is non-standard.
 */
export function zeroValue(primaryType: string, types: EIP712Types = {}): EIP712ObjectValue {
  // If the type is a built-in, return a pre-defined zero value.
  if (EIP712_BUILTIN_TYPES.includes(primaryType)) {
    if (EIP712_BYTES_REGEXP.test(primaryType)) {
      return Buffer.alloc(0)
    }
    if (EIP712_INT_REGEXP.test(primaryType)) {
      return 0
    }
    if (primaryType === 'bool') {
      return false
    }
    if (primaryType === 'address') {
      return NULL_ADDRESS
    }
    if (primaryType === 'string') {
      return ''
    }
  }

  // If the type is an array, return an empty array or an array of the given fixed length.
  if (EIP712_ARRAY_REGEXP.test(primaryType)) {
    const match = EIP712_ARRAY_REGEXP.exec(primaryType)
    const memberType: string = match?.groups?.memberType!
    const fixedLengthStr: string | undefined = match?.groups?.fixedLength
    const fixedLength: number = fixedLengthStr === undefined ? 0 : parseInt(fixedLengthStr, 10)
    return [...new Array(fixedLength).keys()].map(() => zeroValue(memberType, types))
  }

  // Must be user-defined type. Return an object with all fields set to their zero value.
  const fields = types[primaryType]
  if (fields === undefined) {
    throw new Error(`Unrecognized primary type for EIP-712 zero value: ${primaryType}`)
  }
  return fields.reduce((obj, field) => ({ ...obj, [field.name]: zeroValue(field.type, types) }), {})
}
