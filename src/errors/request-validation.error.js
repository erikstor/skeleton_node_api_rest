
import { CustomError } from './custom.error.js'

export class RequestValidationError extends CustomError {

  statusCode = 400

  constructor(errors) {
    super('Invalid request parameters')

    this.errors = errors

    Object.setPrototypeOf(this, RequestValidationError.prototype)
  }

  serialize() {
    // todo modificar en este punto para devolver el primer error
    const message = Array.isArray( this.errors) &&  this.errors.length > 0 ? this.errors[0]?.msg: 'Ocurrió un error en la validación de datos'
    return {
      code: this.statusCode,
      //message: 'Lista de parámetros que no pasaron la validación.',
      message,
      error: this.errors.map(x => {
        return {
          message: x.msg,
          field: x.param
        }
      })
    }
  }

}

