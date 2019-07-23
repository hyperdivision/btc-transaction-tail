const { FullNode } = require('bcoin')
const filter = { test: () => true, add () {} }

module.exports = class BtcTransactionTail {
  constructor (opts) {
    if (!opts) opts = {}

    this.node = new FullNode({
      network: 'main',
      config: true,
      argv: true,
      env: true,
      // prune: true,
      // logFile: true,
      // logConsole: true,
      // logLevel: 'info',
      db: 'leveldb',
      memory: false,
      persistent: true,
      workers: true,
      listen: true,
      loader: require
    })

    this.index = opts.since || 0
    this.filter = opts.filter || (() => true)
    this.confirmations = opts.confirmations || 0

    this._transaction = opts.transaction || noop
    this._checkpoint = opts.checkpoint || noop
  }

  _filter (addr) {
    return addr && this.filter(addr)
  }

  async _filterTx (tx) {
    for (const inp of tx.inputs) {
      const data = inp.toJSON()

      if (await this._filter(data.address, 'in')) return true
    }

    for (const out of tx.outputs) {
      const data = out.toJSON()

      if (await this._filter(data.address, 'out')) return true
    }

    return false
  }

  async start () {
    const node = this.node

    await node.ensure()
    await node.open()
    await node.connect()

    node.startSync()

    while (true) {
      await node.scan(this.index, filter, async (block, txs) => {
        const blockData = block.toJSON()
        const confirmations = node.chain.tip.height - blockData.height
        if (confirmations < this.confirmations) return

        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i]

          if (await this._filterTx(tx)) {
            const data = tx.toJSON()

            const transaction = {
              blockHash: blockData.hash,
              blockNumber: blockData.height,
              confirmations,
              transactionIndex: i,
              hash: data.hash,
              inputs: data.inputs,
              outputs: data.outputs
            }

            await this._transaction(transaction)
          }
        }

        await this._checkpoint(++this.index)
      })

      do {
        await sleep(1000)
      } while (node.chain.tip.height - this.index < this.confirmations)
    }
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function noop () {}
