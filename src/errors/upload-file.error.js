
import  {CustomError} from './custom.error.js'

export  class UploadFileError extends CustomError {

  statusCode = 400

  constructor(errors) {
    super('S3 error: ', errors.message)


    Object.setPrototypeOf(this, UploadFileError.prototype)
  }

  serialize() {
    return {
      code: this.statusCode,
      message: 'Ocurrió un error al subir el archivo al S3',
    }
  }

}

