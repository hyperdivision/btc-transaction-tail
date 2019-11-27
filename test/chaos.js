const tape = require('tape')
const { setup, createNodes, createTail } = require('./helpers')

tape('setup', async function (t) {
  await setup()
  t.end()
})

tape('chaos', async function (t) {
  const res = new Map()
  const [n1, n2] = await createNodes()

  let db = []
  let ops = 50

  const tail = createTail({
    async transaction (tx) {
      db.push(tx)
      for (const inp of tx.inputs) {
        if (inp.address) {
          const n = res.get(inp.address) || 0
          res.set(inp.address, n - (inp.value || 0))
        }
      }
      for (const out of tx.outputs) {
        if (out.address) {
          const n = res.get(out.address) || 0
          res.set(out.address, n + out.value)
        }
      }
      if (tx.blockNumber < 1000) return
      await op(tx.blockNumber)
    },
    async checkpoint (n) {
      if (await n1.client.getBlockCount() === n + 1) {
        if (ops > 0) {
          ops--
          t.pass('end of tail, executing fuzz op. remaining ops ' + ops)
          await fuzz()
          return
        }

        tail.stop()
        t.same(res, await expected(n1.client))
        t.end()
      }
    },
    reorganize (since) {
      t.pass('reorg, undoing tx')

      for (const tx of db.slice(since)) {
        for (const inp of tx.inputs) {
          if (inp.address) {
            const n = res.get(inp.address) || 0
            res.set(inp.address, n + (inp.value || 0))
          }
        }
        for (const out of tx.outputs) {
          if (out.address) {
            const n = res.get(out.address) || 0
            res.set(out.address, n - out.value)
          }
        }
      }
      db = db.slice(0, since)
    }
  })

  await tail.start()
  tail.scan()

  async function fuzz () {
    const n = Math.random()
    const [a, b] = Math.random() < 0.5 ? [n1, n2] : [n2, n1]

    if (n < 0.5) {
      t.pass('mining new blocks')
      await a.generate(Math.ceil(Math.random() * 5))
    } else if (n < 0.9) {
      t.pass('sending coins')
      try {
        await a.simpleSend(Math.ceil(Math.random() * 10), [b.genAddress])
      } catch (_) {
        t.pass('balance too low, generating instead')
        await a.generate(Math.ceil(Math.random() * 5))
      }
    } else {
      t.pass('reorg')
      await a.reorg(5)
      await a.generate(10)
    }
  }

  async function op (block) {
    const n = Math.random()

    if (n < 0.99) return

    t.pass('executing random op at block ' + block + '/' + (await n1.client.getBlockCount()))
    await fuzz()
  }
})

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function expected (client) {
  const m = new Map()
  for (const e of await client.listAddressGroupings()) {
    const [addr, balance] = e[0]
    if (balance) m.set(addr, balance * 1e8)
  }
  return m
}
