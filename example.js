const BitcoinTail = require('./')

const t = new BitcoinTail({
  since: 99000,
  confirmations: 100,
  transaction (t) {
    console.log(t.blockNumber, t.confirmations)
  },
  checkpoint (index) {
    console.log('should start at', index)
  }
})

t.start().catch(console.log)
