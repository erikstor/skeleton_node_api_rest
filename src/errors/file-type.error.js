
import  {CustomError} from './custom.error.js'

export  class FileTypeError extends CustomError {

  statusCode = 400

  constructor(type) {
    super('Invalid file')
    this.type = type
    Object.setPrototypeOf(this, FileTypeError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'El tipo de archivo incluido no es el correcto, se espera un archivo de tipo: ' + this.type,
    }
  }

}

