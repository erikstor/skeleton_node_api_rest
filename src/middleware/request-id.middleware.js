
import crypto from 'crypto'
import { logger } from '../utils/index.js'

class RequestIdMiddleware {

  constructor() {

  }
  async main(req, res, next) {
    // console.log('logger --->',this.logger)

    req.requestId = crypto.randomBytes(5).toString('hex')

    logger.info(`request: ${req.requestId} -- ${req.method} to: ${req.get('host')}${req.originalUrl}`)

    next()
  }

}

export const requestIdMiddleware = new RequestIdMiddleware()

