const Client = require('bitcoin-core')
const Node = require('bitcoind-coinbase-test')
const Tail = require('../../')

module.exports = { createNodes, reset, setup, createTail }

async function createNodes (nodes = 2) {
  const res = []
  for (let i = 0; i < nodes; i++) {
    const client1 = new Client({
      port: 18443,
      network: 'regtest',
      username: 'test',
      password: 'password',
      wallet: '' + (i + 1)
    })

    const node1 = new Node(client1)
    await node1.init('bech32')
    res.push(node1)
  }

  return res
}

function createTail (opts = {}) {
  const t = new Tail({
    network: 'regtest',
    confirmations: 0,
    bcoin: {
      memory: true,
      persistent: true,
      nodes: ['localhost:18444'],
      // logLevel: 'info'
    },
    ...opts
  })

  return t
}

async function setup () {
  const [node] = await createNodes()
  if (await node.client.getBlockCount() < 1000) {
    await reset()
    await node.generate(1000)
  }
}

async function reset () {
  const [node1, node2] = await createNodes()
  await node1.init('bech32')
  await node1.reorg(await node1.client.getBlockCount())
  await node1.reset()
  await node2.init('bech32')
  await node2.reorg(await node2.client.getBlockCount())
  await node2.reset()
  return [node1, node2]
}


function createTail (opts = {}) {
  const t = new Tail({
    network: 'regtest',
    confirmations: 0,
    bcoin: {
      memory: true,
      persistent: true,
      nodes: ['localhost:18444'],
      // logLevel: 'info'
    },
    ...opts
  })

  return t
}
