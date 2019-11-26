const tape = require('tape')
const { setup, createNodes, createTail } = require('./helpers')

tape('setup', async function (t) {
  await setup()
  t.end()
})

tape('reorg', async function (t) {
  const [node1, node2] = await createNodes()

  let since = -1
  let reorged = -1
  let prevTx = null

  const tail = createTail({
    async transaction (tx) {
      if (since > -1) {
        if (tx.blockNumber !== since) {
          t.fail('Unexpected reorg block')
          return
        }
        if (tx.hash === (await s).txid) {
          t.notEqual(tx.blockNumber, prevTx.blockNumber, 'same tx, different block')
          return
        }
        return
      }

      if (tx.hash === (await s).txid) {
        prevTx = tx
        t.pass('tailed transaction, reorging')
        await node1.reorg(10)
        await node1.generate(19)
      }
    },
    async checkpoint (s) {
      if (since > -1) {
        since = s
      }
      if (since - reorged === 30) {
        tail.stop().then(() => t.end())
      }
    },
    async reorganize (s) {
      t.pass('reorg triggered')
      reorged = since = s
    }
  })

  await tail.start()
  const start = await node1.client.getBlockCount() + 1
  tail.scan(start)

  const s = node1.simpleSend(123, [node2.genAddress])
})

tape('reorg one', async function (t) {
  const [node1, node2] = await createNodes(2)

  let since = -1
  let reorged = -1
  let prevTx = null

  const tail = createTail({
    async transaction (tx) {
      if (since > -1) {
        if (tx.blockNumber !== since) {
          t.fail('Unexpected reorg block')
          return
        }
        if (tx.hash === (await s).txid) {
          t.notEqual(tx.blockNumber, prevTx.blockNumber, 'same tx, different block')
          return
        }
        return
      }

      if (tx.hash === (await s).txid) {
        prevTx = tx
        t.pass('tailed transaction, reorging')
        await c
        await node1.reorg(3)
        await node1.generate(1)
      }
    },
    async checkpoint (s) {
      if (since > -1) {
        since = s
      }
      if (since - reorged === 4) {
        tail.stop().then(() => t.end())
      }
    },
    async reorganize (s) {
      t.pass('reorg triggered')
      reorged = since = s
    }
  })

  await tail.start()
  const start = await node1.client.getBlockCount() + 1
  tail.scan(start)

  const s = node1.simpleSend(123, [node2.genAddress], 0, false)
  await s
  const c = node1.confirm(1)
})
