const ChainNode = require('./chain-node')
const filter = { test: () => true, add () {} }

class BtcTransactionTail {
  constructor (opts) {
    if (!opts) opts = {}

    this.network = opts.network

    this.node = new ChainNode(Object.assign({
      network: opts.network,
      listen: false,
      selfish: true,
      prefix: opts.prefix,
      prune: true,
      db: 'leveldb',
      memory: false,
      persistent: true,
      workers: true
    }, opts.bcoin))

    this.index = 0
    this.started = false
    this.filter = opts.filter || (() => true)
    this.confirmations = opts.confirmations || 0

    this._transaction = opts.transaction || noop
    this._checkpoint = opts.checkpoint || noop
    this._scanning = null
    this._waitingForBlock = false
  }

  _filter (addr) {
    return addr && this.filter(addr)
  }

  get height () {
    return this.node.chain.tip.height
  }

  async _filterTx (tx) {
    for (const inp of tx.inputs) {
      const data = inp.getJSON(this.network)

      if (await this._filter(data.address, BtcTransactionTail.IN)) return true
    }

    for (const out of tx.outputs) {
      const data = out.getJSON(this.network)

      if (await this._filter(data.address, BtcTransactionTail.OUT)) return true
    }

    return false
  }

  async _onblock (block, txs) {
    const node = this.node
    const blockData = block
    const confirmations = node.chain.tip.height - blockData.height
    if (confirmations < this.confirmations) return

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i]

      if (await this._filterTx(tx)) {
        const data = tx.getJSON(this.network)

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

  async start (since) {
    const node = this.node

    if (!this.started) {
      await node.ensure()
      await node.open()
      await node.connect()
      node.startSync()
    }

    this.started = true
    this.index = since || this.index

    let doneScanning = null
    this._scanning = new Promise(resolve => { doneScanning = resolve })

    interceptPrune(this, this.index)

    while (this.started) {
      await node.scan(this.index, filter, (block, txs) => this._onblock(block, txs))

      // suspend execution while we wait for more blocks
      while (this.started && node.chain.tip.height - this.index < this.confirmations) {
        this._waitingForBlock = true
        try {
          await once(node, 'block')
          this._waitingForBlock = false
        } catch (err) {
          this._waitingForBlock = false
          if (!this.started) break
          throw err
        }
      }
    }

    doneScanning()
  }

  async stop () {
    const started = this.started
    this.started = false
    if (started) {
      if (!this._waitingForBlock) await this._scanning
      this.node.stopSync()
      await this.node.disconnect()
      await this.node.close()
    }
  }
}

function interceptPrune (self, index) {
  const db = self.node.chain.db
  const pruneBlock = db.pruneBlock

  db.pruneBlock = async function () {
    while (index < self.index) {
      await pruneBlock.call(db, { height: index++ })
    }
  }
}

function once (ee, event) {
  return new Promise(resolve => {
    ee.once(event, resolve)
  })
}

function noop () {}

BtcTransactionTail.IN = Symbol('in')
BtcTransactionTail.OUT = Symbol('out')

module.exports = BtcTransactionTail
