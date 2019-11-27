const ChainNode = require('./chain-node')
const EventEmitter = require('events')
const filter = { test: () => true, add () {} }

const STOPPED = new Error('STOPPED')

class BtcTransactionTail extends EventEmitter {
  constructor (opts) {
    super()
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

    this.node.mempool.on('tx', async (tx) => {
      try {
        if (!await this._filterTx(tx)) return
      } catch (_) {
        return
      }

      this.emit('mempool-add', this._makeTx(tx))
    })

    this.node.mempool.on('remove entry', async (entry) => {
      try {
        if (!await this._filterTx(entry.tx)) return
      } catch (_) {
        return
      }

      this.emit('mempool-remove', this._makeTx(entry.tx))
    })

    this.index = 0
    this.started = false
    this.filter = opts.filter || (() => true)
    this.confirmations = opts.confirmations || 0

    this._lastBlockHeight = -1
    this._transaction = opts.transaction || noop
    this._checkpoint = opts.checkpoint || noop
    this._reorganize = opts.reorganize || noop
    this._scanning = null
    this._reorging = null
    this._waitingForBlock = null
    this._reorgs = 0
    this._fork = 0
  }

  _makeTx (tx) {
    const data = tx.getJSON(this.network)
    return {
      hash: data.hash,
      inputs: data.inputs,
      outputs: data.outputs,
      locktime: data.locktime,
      time: new Date(data.mtime * 1000)
    }
  }

  _filter (addr, dir) {
    return addr && this.filter(addr, dir)
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

  async start () {
    const node = this.node

    if (!this.started) {
      await node.ensure()
      await node.open()
      await node.connect()
      node.startSync()
      this._interceptReorgs()
    }

    this.started = true
  }

  async scan (since) {
    const node = this.node
    const reorgs = this._reorgs

    const onblock = async (block, txs) => {
      if (this._reorgs !== reorgs) throw STOPPED

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
            outputs: data.outputs,
            time: new Date(blockData.time * 1000)
          }

          await this._transaction(transaction)
          this._lastBlockHeight = blockData.height
          if (!this.started) return
        }
      }

      await this._checkpoint(++this.index)
      if (this._reorgs !== reorgs) throw STOPPED
    }

    this.index = since === 0 ? 0 : (since || this.index)

    let doneScanning = null
    this._scanning = new Promise(resolve => { doneScanning = resolve })

    while (this._reorgs === reorgs && this.started) {
      try {
        await node.scan(this.index, filter, onblock)
      } catch (err) {
        if (err === STOPPED) break
        throw err
      }

      // suspend execution while we wait for more blocks
      while (this._reorgs === reorgs && this.started && node.chain.tip.height - this.index < this.confirmations) {
        this._waitingForBlock = once(node, 'block')
        await this._waitingForBlock.promise
        this._waitingForBlock = null
      }
    }

    doneScanning()

    if (this._reorgs !== reorgs) {
      await this._reorging
      return this.scan(this._fork)
    }
  }

  async stop () {
    const started = this.started
    this.started = false
    if (started) {
      if (this._waitingForBlock) this._waitingForBlock.stop()
      await this._scanning
      this.node.stopSync()
      await this.node.disconnect()
      await this.node.close()
    }
  }

  _interceptReorgs () {
    const reorganize = this.node.chain.reorganize
    this.node.chain.reorganize = async (competitor) => {
      const tip = this.node.chain.tip

      let doneResolve
      let doneReject

      this._reorging = new Promise((resolve, reject) => {
        doneResolve = resolve
        doneReject = reject
      })

      this._reorgs++

      if (this._waitingForBlock) this._waitingForBlock.stop()
      await this._scanning

      const fork = await this.node.chain.findFork(tip, competitor)

      if (fork.height >= this._lastBlockHeight) { // we havent seen any of the reorg'ed tx so just continue
        this._fork = this.index
      } else { // notify the user
        const index = this._fork = fork.height + 1

        try {
          await this._reorganize(index, fork)
        } catch (err) {
          doneReject(err)
          return new Promise(() => {}) // "block" the reorg so it does not retry
        }
      }

      const res = await reorganize.call(this.node.chain, competitor)
      doneResolve()
      return res
    }
  }
}

function once (ee, event) {
  let stop

  const promise = new Promise(resolve => {
    ee.once(event, resolve)
    stop = () => {
      ee.removeListener(event, resolve)
      resolve()
    }
  })

  return { promise, stop }
}

function noop () {}

BtcTransactionTail.IN = Symbol('in')
BtcTransactionTail.OUT = Symbol('out')

module.exports = BtcTransactionTail
