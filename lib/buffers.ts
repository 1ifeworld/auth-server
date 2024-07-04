import { blake3 } from '@noble/hashes/blake3'
import { base64url } from '@scure/base'
import type { MessageData } from '../lib/types'

/**
 * @dev Serialize MessageData object into a Uint8Array
 */

// shout out 0xTranqui

export function messageDataToUint8Array(message: MessageData): Uint8Array {
  const jsonString = JSON.stringify(message, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
  const encoder = new TextEncoder()
  return encoder.encode(jsonString)
}

/**
 * @dev Deserialize Uint8Array into MessageData object
 */

export function uint8ArrayToMessageData(uint8Array: Uint8Array): MessageData {
  const decoder = new TextDecoder()
  const jsonString = decoder.decode(uint8Array)
  return JSON.parse(jsonString, (key, value) =>
    key === 'rid' || key === 'timestamp' ? BigInt(value) : value,
  )
}

/**
 * @dev Calculate cid hash from serialized messageData object
 * @notice blake3 default length is 32 bytes but hardcoded for readability
 */
export function messageDataToCid(messageData: MessageData): Uint8Array {
  const serializedMessageData = messageDataToUint8Array(messageData)
  return blake3(serializedMessageData, { dkLen: 32 })
}

/**
 * @dev Convert cid to base64Url multicodec for ipfs CIDv1 compatability (???)
 */
// export function cidAsBase64UrlMulticodec(cid: Uint8Array): string {
//   // raw inner data: cid version 1, raw multicodec 0x55, blake3 multihash 0x1e, len of 32
//   const prefixBytes = new Uint8Array([0x01, 0x55, 0x1e, 0x20])
//   // This creates a new Uint8Array with a length equal to length of prefix and cid lengths. The array is initialized with zeros.
//   const combinedBytes = new Uint8Array(prefixBytes.length + cid.length)
//   // This copies the values from prefix into combined, starting at index 0. After this operation, the first four bytes of combined will be [0x01, 0x55, 0x1e, 0x20].
//   combinedBytes.set(prefixBytes)
//   // This appends the cid bytes immediately after the prefix bytes.
//   combinedBytes.set(cid, prefixBytes.length)
//   // Convert bytes to base64Url and prepend with 'u'
//   return "u" + base64url(combinedBytes)
// }

/**
 * @dev Convert base64Url multicodec back to cid hash
 */
// export function base64UrlMulticodecToCid(base64Url: string): Uint8Array {
//   // Remove the 'u' prefix
//   const base64UrlWithoutPrefix = base64Url.slice(1)
//   // Decode the Base64URL string to a Uint8Array
//   const combinedBytes: Uint8Array = base64url.toBuffer(base64UrlWithoutPrefix)
//   // Return extracted CID bytes by removing the prefix
//   return combinedBytes.slice(4)
// }

/*
    // NOTE: removed multiformats block encoding for now after swapping in blake3
    import * as Block from "multiformats/block"
    import * as dagCbor from "@ipld/dag-cbor"
    import { sha256 } from "multiformats/hashes/sha2"

    // @dev Use this to turn unstructured data in multiformats blocks Cids. Useful for large files + objects
    // @dev To then get the CID, you can call {block}.cid.toString()
    // @example const messageCid = (await encodeBlock()).cid.toString()
    export async function encodeBlock(value: unknown) {
        return await Block.encode({ value, codec: dagCbor, hasher: sha256 })
    }
*/
