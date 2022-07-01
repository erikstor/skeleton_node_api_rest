import { JWTService } from '../services/index.js'
import { AuthError } from '../errors/auth.error.js'
import { logger } from '../utils/index.js'



class JWTMiddleware {

  async verify(req, res, next) {

    const authorization = req.headers.authorization //  req.get('Authorization')
    if (!authorization) {

      return next(new AuthError())
    }

    const _token = authorization.replace('Bearer ', '')

    try {
      const service = new JWTService()
      req.user = {
        ...(await service.verify(_token))
      }
      req.userToken = _token

      next()
      logger.info(`request: ${req.requestId} by user:${req.user.id}`)

    } catch (e) {
      console.log(e)

      next(new AuthError())

    }
  }
}

export const authMiddleware = new JWTMiddleware()

