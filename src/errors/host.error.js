import  {CustomError} from './custom.error.js'

export class HostError extends CustomError {

  statusCode = 401

  constructor() {
    super('Host Error')
    Object.setPrototypeOf(this, HostError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'Error, Host invalido',
    }
  }

}
