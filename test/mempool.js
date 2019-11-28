const tape = require('tape')
const { setup, createNodes, createTail } = require('./helpers')

tape('setup', async function (t) {
  await setup()
  t.end()
})

tape('mempool tracking', async function (t) {
  t.plan(2)

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

  await sleep(5000)

  const txp = n1.simpleSend(10, [n2.genAddress], undefined, false)

  await txp
  await sleep(10000)

  await n1.confirm()
})

tape('mempool consistency', async function (t) {
  const [n1, n2] = await createNodes()

  for (let i = 0; i < 10; i++) {
    await n1.simpleSend(1, [n2.genAddress], undefined, false)
  }

  const tail = createTail()

  await tail.start()

  const pool = new Map()

  tail.on('mempool-add', function (tx) {
    pool.set(tx.hash, tx)
  })

  tail.on('mempool-remove', function (tx) {
    pool.delete(tx.hash, tx)
  })

  await sleep(10000)

  const txp = n1.simpleSend(10, [n2.genAddress], undefined, false)

  await txp
  // await n1.replaceByFee(old.inputs, old.outputs)
  await sleep(10000)
  await check()
  await n1.confirm()
  await sleep(5000)
  await check()

  await tail.stop()
  t.end()

  async function check (retry = true) {
    const remote = await n1.client.getMemoryPoolContent()
    const same = Object.keys(remote).sort().join('\n') === [...pool.keys()].sort().join('\n')
    if (!same && retry) {
      t.pass('not consistent check, waiting another 10s')
      await sleep(10000)
      return check(false)
    }
    t.same(Object.keys(remote).sort(), [...pool.keys()].sort(), 'same mempool')
  }
})

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
