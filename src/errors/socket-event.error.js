

import  {CustomError} from './custom.error.js'
export  class AuthError extends CustomError {


  
  constructor(error) {
    super('Socket Error')
    // Object.setPrototypeOf(this, AuthError.prototype)

    this.statusCode = error.code || 401
    this.message = `message from socket -> ${error.message}` || 'Socket error' 
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'Socket error',
    }
  }

}

