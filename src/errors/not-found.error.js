

import  {CustomError} from './custom.error.js'

export  class NotFoundError extends CustomError {

  statusCode = 404

  constructor() {
    super('Not Found Error')
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'No se encontró el registro.',
    }
  }

}

