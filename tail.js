"use strict"

const EventEmitter = require("events")
const fs = require('fs')
const iconv = require('iconv-lite')
const env = process.env['NODE_ENV'] || 'development'

class Tail extends EventEmitter {
  constructor(filename, options) {
    super()
    this.filename = filename
    
    if (!options) options = {}
    this.separator = options.separator || /[\r]{0,1}\n/
    this.fsWatchOptions = options.fsWatchOptions || {}
    this.fromStart = options.fromStart || false
    this.fromLine = options.fromLine || 0
    
    if (env === 'development') {
      console.log('let go to tail...')
      console.log(`filename: ${filename}`)
    }
    
    this.internalDispatcher = new EventEmitter()
    this.queue = []
    this.isWatching = false
    
    this.internalDispatcher.on('message', () => this.readDatas())
    
    this.watch()
  }
  
  readDatas() {
    if (this.queue.length >= 1) {
      const block = this.queue.shift()
      const start = block.start
      const end = block.end
      if (end > start) {
        const chunks = []
        let size = 0
        const rs = fs.createReadStream(this.filename, {start, end: end - 1})
        
        rs.on('data', (chunk) => {
          chunks.push(chunk)
          size += chunk.length
        })
        
        rs.on('error', (error) => {
          if (env === 'development') {
            console.log(`Tail error: ${error}`)
          }
          this.emit('error', error)
        })
        
        rs.on('end', () => {
          const buffer = Buffer.concat(chunks, size)
          const data = iconv.decode(buffer, 'utf8')
          
          const datas = data.split(this.separator)
          
          if (start === 0 && this.fromLine > 0) {
            datas.splice(0, this.fromLine - 1)
          }
          
          datas.forEach((lineData) => this.emit('line', lineData))
          
          if (this.queue.length >= 1) {
            this.internalDispatcher.emit('message')
          }
        })
      }
    }
  }
  
  watch() {
    if (this.isWatching) return 
    
    this.isWatching = true
    const stats = fs.statSync(this.filename)
    this.pos = stats.size
    if (this.fromStart) {
      this.pos = 0
    }
    
    if (stats.size > this.pos) {
      this.watchEventHandler('change')
    }
    
    if (fs.watch) {
      return this.watcher = fs.watch(this.filename, this.fsWatchOptions, (e) => this.watchEventHandler(e))
    }
    fs.watchFile(this.filename, this.fsWatchOptions, (curr, prev) => this.watchFileEventHandler(curr, prev))
  }
  
  watchEventHandler(e) {
    if (e === 'change') {
      const stats = fs.statSync(this.filename)
      if (stats.size < this.pos) this.pos = stats.size
      if (stats.size > this.pos) {
        const pos = this.pos > 0 ? this.pos + 1 : this.pos
        this.queue.push({start: pos, end: stats.size})
        this.pos = stats.size
        if (this.queue.length === 1) {
          this.internalDispatcher.emit('message')
        }
      }
    } else {
      this.unwatch()
      setTimeout(() => this.watch(), 1000)
    }
  }
  
  watchFileEventHandler(curr, prev) {
    if (curr.size > prev.size) {
      this.queue.push({start: prev.size, end: curr.size})
      if (this.queue.length === 1) {
        this.internalDispatcher.emit('message')
      }
    }
  }
  
  unwatch() {
    this.isWatching = false
    this.queue = []
    if (fs.watch && this.watcher) return this.watcher.close()
    this.unwatchFile(this.filename)
  }
} 

module.exports = Tail