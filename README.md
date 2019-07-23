# btc-transaction-tail

Tails transactions on the Bitcoin blockchain

```
npm install @hyperdivision/btc-transaction-tail
```

## Usage

``` js
const Tail = require('btc-transaction-tail')

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

// tail.index is the current block index
await tail.start() // start tailing, will throw if an error is hit
```
