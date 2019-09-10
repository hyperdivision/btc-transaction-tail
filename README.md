# `@hyperdivision/btc-transaction-tail`

[![Build Status](https://travis-ci.com/hyperdivision/btc-transaction-tail.svg?token=KyDcSdVQn6Rwq16oPikX&branch=master)](https://travis-ci.com/hyperdivision/btc-transaction-tail)

Tails transactions on the Bitcoin blockchain

```
npm install @hyperdivision/btc-transaction-tail
```

## Usage

``` js
const Tail = require('@hyperdivision/btc-transaction-tail')

const tail = new Tail({
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
  // tail chain since this seq (inclusive)
  await tail.start(424244) // start tailing, will throw if an error is hit
})().catch(console.error)
```

## API

### `const tail = new Tail(opts)`

```js
{
  network: 'main',
  confirmations: 0,
  prefix: null, // Where to store chain data
  // direction can be either IN or OUT symbol
  async filter (addressString, direction) { return true },
  async transaction (bcoin.TX) { },
  async checkpoint (blockHeight) { },
  // Pass options directly to bcoin FullNode
  // May overwrite some of the previous opts
  bcoin: {}
}
```

### `Tail.IN`

Signals a transaction that has a filtered address in the inputs

### `Tail.OUT`

Signals a transaction that has a filtered address in the output

### `tail.start()`

### `tail.scan(since = 0)`

### `tail.stop()`
