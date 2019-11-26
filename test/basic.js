const tape = require('tape')
const { setup, createNodes, createTail } = require('./helpers')

tape('setup', async function (t) {
  await setup()
  t.end()
})

tape('mine one', async function (t) {
  t.plan(2)

  const [node] = await createNodes()

  const tail = createTail({
    async transaction (tx) { // only one block mined below
      t.same(tx.blockNumber, start)
      t.same(tx.transactionIndex, 0)
      tail.stop().then(() => t.end())
    }
  })

  await tail.start()
  const start = await node.client.getBlockCount() + 1
  await node.generate(1)
  tail.scan(start)
})

tape('transfer', async function (t) {
  const [node1, node2] = await createNodes()

  const tail = createTail({
    async transaction (tx) {
      if (!tx.outputs[0]) return
      const o = tx.outputs[0]
      if (o.value === 12300000000) {
        const { inputs } = await s
        t.same(inputs.length, tx.inputs.length)
        const expected = inputs.map(t => t.address)
        const actual = tx.inputs.map(t => t.address)
        t.same(actual, expected)
        tail.stop().then(() => t.end())
      }
    }
  })

  await tail.start()
  const start = await node1.client.getBlockCount() + 1
  tail.scan(start)

  const s = node1.simpleSend(123, [node2.genAddress])
})
