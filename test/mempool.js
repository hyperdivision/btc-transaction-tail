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
  let txp = null

  tail.on('mempool-add', async function (tx) {
    if (txp && tx.hash === (await txp).txid) {
      t.same(tx.hash, (await txp).txid, 'added transaction to mempool')
    }
  })

  tail.on('mempool-remove', async function (tx) {
    if (txp && tx.hash === (await txp).txid) {
      t.same(tx.hash, (await txp).txid, 'removed transaction from mempool')
      tail.stop().then(() => t.end())
    }
  })

  await sleep(5000)

  txp = n1.simpleSend(10, [n2.genAddress], undefined, false)

  await txp
  await sleep(10000)

  await n1.confirm()
})

tape.skip('mempool consistency', async function (t) {
  const [n1, n2] = await createNodes()

  let old
  for (let i = 0; i < 10; i++) {
    old = await n1.simpleSend(1, [n2.genAddress], undefined, false)
  }

  const tail = createTail()

  await tail.start()

  const pool = new Map()

  let oldRemoved = false
  let oldAdded = false
  let replacedAdded = false
  let replaced = null

  tail.on('mempool-add', async function (tx) {
    if (old.txid === tx.hash) {
      t.notOk(oldRemoved, 'old tx not removed')
      t.notOk(oldAdded, 'old tx not added twice')
      t.pass('added old tx')
      oldAdded = true
    }
    const r = await replaced
    if (r && r.txid === tx.hash) {
      t.notOk(replacedAdded, 'replaced tx only added once')
      t.ok(oldRemoved, 'replaced old tx')
      replacedAdded = true
    }
    pool.set(tx.hash, tx)
  })

  tail.on('mempool-remove', function (tx) {
    if (old.txid === tx.hash) {
      t.ok(oldAdded, 'old tx added')
      t.notOk(oldRemoved, 'old tx not removed twice')
      t.pass('removed old tx')
      oldRemoved = true
    }
    pool.delete(tx.hash, tx)
  })

  await sleep(10000)

  const txp = n1.simpleSend(10, [n2.genAddress], undefined, false)

  await txp
  replaced = n1.replaceByFee(old.inputs, old.outputs)
  await replaced
  await sleep(10000)
  await check()
  await n1.confirm()
  await sleep(5000)
  t.pass('after confirm')
  await check()

  await tail.stop()

  t.ok(oldRemoved && replacedAdded, 'executed replaceByFee')
  t.end()

  async function check (retry = 3) {
    const remote = await n1.client.getMemoryPoolContent()
    const same = Object.keys(remote).sort().join('\n') === [...pool.keys()].sort().join('\n')
    if (!same && retry) {
      t.pass('not consistent check, waiting another 10s')
      await sleep(10000)
      return check(retry - 1)
    }
    t.same([...pool.keys()].sort(), Object.keys(remote).sort(), 'same mempool')
  }
})

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
