const BitcoinTail = require('./')

const t = new BitcoinTail({
  confirmations: 100,
  transaction (t) {
    console.log(t.blockNumber, t.confirmations, t.time)
  },
  checkpoint (index) {
    console.log('should start at', index)
  },
  bcoin: {
    memory: true,
    persistent: false
  }
})

t.start().then(() => {
  t.scan(0).catch(console.log)
}).catch(console.log)
