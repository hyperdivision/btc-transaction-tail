const BitcoinTail = require('./')

const t = new BitcoinTail({
  confirmations: 100,
  transaction (t) {
    console.log(t.blockNumber, t.confirmations)
  },
  checkpoint (index) {
    console.log('should start at', index)
  },
  bcoin: {
    memory: true,
    persistent: false
  }
})

t.start(10).catch(console.log)
