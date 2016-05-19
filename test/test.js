const Tail = require('../tail')
const tail = new Tail('./test.log', {n: 2})

tail.on('line', (data) => {
  console.log(data)
})

const fs = require('fs')
var i = 0
setInterval(() => {
  fs.appendFileSync('./test.log', `\nhello ${i++}\n`)
}, 1000)