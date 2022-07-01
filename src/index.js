
import OS from 'os'
import cluster from 'cluster'
import  Api from './api/index.js'

//console.log('original process.env.UV_THREADPOOL_SIZE',process.env.UV_THREADPOOL_SIZE)
process.env.UV_THREADPOOL_SIZE = OS.cpus().length;
//console.log('set os cores process.env.UV_THREADPOOL_SIZE', process.env.UV_THREADPOOL_SIZE)
// console.log(OS.cpus().length)
// ps -Lef | grep  "\<node\>" | wc -l
// export UV_THREADPOOL_SIZE=16 && node src/index.js

function initApp() {

  if (Number(process.env.CLUSTER) === 1) {
    const MAX_DEATHS = 100
    let deathsCount = 0

    if (cluster.isPrimary) {
      console.log('Loading cluster...')

      console.log('cluster primary id is: ', process.pid)
      for (let i = 0; i < process.env.UV_THREADPOOL_SIZE; i++) {
        cluster.fork()
      }
      //if the worker dies, restart it.
      cluster.on('exit', function (worker) {
        console.log('Worker ' + worker.id + ' died..')
        cluster.fork()
        // avoid infinite loop when there are a programming error
        deathsCount++
        console.log(deathsCount)
        if (deathsCount > MAX_DEATHS) {
          process.exit(0)
        }
      })
    } else {
      // console.log(process.env.CLUSTER)
      // console.log('worker id:', process.pid)
      const api = new Api()
      api.initializeServer()
    }
  } else {
    const api = new Api()
    api.initializeServer()
  }
}
initApp()


