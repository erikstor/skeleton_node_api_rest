
import  {CustomError} from './custom.error.js'

export class AuthError extends CustomError {

  statusCode = 401

  constructor() {
    super('Auth Error')
    Object.setPrototypeOf(this, AuthError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'Debe iniciar sesión',
    }
  }

}

