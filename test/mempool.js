const tape = require('tape')
const { setup, createNodes, createTail } = require('./helpers')

tape('setup', async function (t) {
  await setup()
  t.end()
})

tape('mempool tracking', async function (t) {
  const [n1, n2] = await createNodes()
  const tail = createTail()

  await tail.start()

  tail.on('mempool-add', async function (tx) {
    t.same(tx.hash, (await txp).txid, 'added transaction to mempool')
  })

  tail.on('mempool-remove', async function (tx) {
    t.same(tx.hash, (await txp).txid, 'removed transaction from mempool')
    tail.stop().then(() => t.end())
  })

  const txp = n1.simpleSend(10, [n2.genAddress], undefined, false)

  await txp
  await sleep(10000)
  await n1.confirm()
})

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
