/* eslint-env mocha */

import { expect } from 'aegir/utils/chai.js'
import { Multiaddr } from '@multiformats/multiaddr'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { Message, MESSAGE_TYPE } from '../../../src/message/index.js'
import { AddProviderHandler } from '../../../src/rpc/handlers/add-provider'
import { createPeerIds } from '../../utils/create-peer-id.js'
import type { PeerId } from '@libp2p/interfaces/peer-id'
import { createValues } from '../../utils/create-values.js'
import type { CID } from 'multiformats'
import type { DHTMessageHandler } from '../../../src/rpc/index.js'
import { Providers } from '../../../src/providers.js'
import { MemoryDatastore } from 'datastore-core'
import { Components } from '@libp2p/interfaces/components'

describe('rpc - handlers - AddProvider', () => {
  let peerIds: PeerId[]
  let values: Array<{ cid: CID, value: Uint8Array }>
  let handler: DHTMessageHandler
  let providers: Providers

  before(async () => {
    [peerIds, values] = await Promise.all([
      createPeerIds(3),
      createValues(2)
    ])
  })

  beforeEach(async () => {
    const datastore = new MemoryDatastore()

    providers = new Providers()
    providers.init(new Components({ datastore }))

    handler = new AddProviderHandler({
      providers
    })
  })

  describe('invalid messages', () => {
    const tests = [{
      message: new Message(MESSAGE_TYPE.ADD_PROVIDER, new Uint8Array(0), 0),
      error: 'ERR_MISSING_KEY'
    }, {
      message: new Message(MESSAGE_TYPE.ADD_PROVIDER, uint8ArrayFromString('hello world'), 0),
      error: 'ERR_INVALID_CID'
    }]

    tests.forEach((t) => {
      it(t.error.toString(), async () => {
        try {
          await handler.handle(peerIds[0], t.message)
        } catch (err: any) {
          expect(err).to.exist()
          expect(err.code).to.eql(t.error)
          return
        }
        throw new Error()
      })
    })
  })

  it('ignore providers that do not match the sender', async () => {
    const cid = values[0].cid
    const msg = new Message(MESSAGE_TYPE.ADD_PROVIDER, cid.bytes, 0)

    const ma1 = new Multiaddr('/ip4/127.0.0.1/tcp/1234')
    const ma2 = new Multiaddr('/ip4/127.0.0.1/tcp/2345')

    msg.providerPeers = [{
      id: peerIds[0],
      multiaddrs: [ma1],
      protocols: []
    }, {
      id: peerIds[1],
      multiaddrs: [ma2],
      protocols: []
    }]

    await handler.handle(peerIds[0], msg)

    const provs = await providers.getProviders(cid)
    expect(provs).to.have.length(1)
    expect(provs[0]).to.eql(peerIds[0])
  })
})