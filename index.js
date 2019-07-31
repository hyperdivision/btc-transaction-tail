const { FullNode } = require('bcoin')
const filter = { test: () => true, add () {} }

module.exports = class BtcTransactionTail {
  constructor (opts) {
    if (!opts) opts = {}

    this.node = new FullNode(Object.assign({
      network: opts.network || 'main',
      listen: false,
      selfish: true,
      prefix: opts.prefix,
      prune: true,
      db: 'leveldb',
      memory: false,
      persistent: true,
      workers: true
    }, opts.bcoin))

    this.started = false
    this.index = opts.since || 0
    this.filter = opts.filter || (() => true)
    this.confirmations = opts.confirmations || 0

    this._transaction = opts.transaction || noop
    this._checkpoint = opts.checkpoint || noop
    if (this.prune) interceptPrune(this)
  }

  _filter (addr) {
    return addr && this.filter(addr)
  }

  get height () {
    return this.node.chain.tip.height
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

  async _onblock (block, txs) {
    const node = this.node
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
  }

  async start () {
    const node = this.node

    if (!this.started) {
      await node.ensure()
      await node.open()
      await node.connect()
      node.startSync()
    }

    this.started = true

    while (true) {
      await node.scan(this.index, filter, (block, txs) => this._onblock(block, txs))

      do await sleep(1000)
      while (node.chain.tip.height - this.index < this.confirmations)
    }
  }
}

function interceptPrune (self) {
  let index = self.index
  const db = self.node.chain.db
  const pruneBlock = db.pruneBlock

  db.pruneBlock = async function () {
    while (index < self.index) {
      try {
      await pruneBlock.call(db, { height: index++ })
      } catch (err) {
        console.log('err', err)
      }
    }
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function noop () {}
