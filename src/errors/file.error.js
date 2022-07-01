
import { CustomError } from './custom.error.js'


export class FileError extends CustomError {

  statusCode = 400

  constructor(errors) {
    super('Invalid file')


    Object.setPrototypeOf(this, FileError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'El archivo adjunto es requerido.',
    }
  }

}

