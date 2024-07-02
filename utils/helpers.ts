import type { MessageData } from './types'
import * as dagCbor from '@ipld/dag-cbor'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'

export async function makeCid(messageData: MessageData) {
  const block = await Block.encode({
    value: messageData,
    codec: dagCbor,
    hasher: sha256,
  })

  return block.cid
}
