
import  {CustomError} from './custom.error.js'

export  class CustomWithDataError extends CustomError {

  statusCode = 400

  constructor(message, data) {

    super('Invalid data')
    
    this.message = message
    this.data = data
    
    Object.setPrototypeOf(this, CustomWithDataError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message:this.message,
      error: this.data
    }
  }

}

