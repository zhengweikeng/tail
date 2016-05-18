const Tail = require('../tail')
const tail = new Tail('./test.log', {fromStart: true, fromLine: 3})

tail.on('line', (data) => {
  console.log(data)
})