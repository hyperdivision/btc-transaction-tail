# btc-transaction-tail

Tails transactions on the Bitcoin blockchain

```
npm install @hyperdivision/btc-transaction-tail
```

## Usage

``` js
const Tail = require('@hyperdivision/btc-transaction-tail')

const tail = new Tail({
  since: 424244, // tail chain since this seq (inclusive)
  confirmations: 10, // require this many confirmations
  async filter (addr) {
    return isInterestingAddress(addr)
  },
  async transaction (transaction) {
    console.log('found this transaction', transaction)
  },
  async checkpoint (since) {
    // store this since so you can restart from here
  }
})

;(async function () {
  // tail.index is the current block index
  await tail.start() // start tailing, will throw if an error is hit
})().catch(console.error)
```

## API

### `const tail = new Tail(opts)`

```js
{
  network: 'main',
  since: 0,
  confirmations: 0,
  prefix: null, // Where to store chain data
  async filter (addressString) { return true },
  async transaction (bcoin.TX) { },
  async checkpoint (blockHeight) { },
  // Pass options directly to bcoin FullNode
  // May overwrite some of the previous opts
  bcoin: {}
}
```
