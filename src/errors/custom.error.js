export   class CustomError extends Error {


  constructor(message = 'Error message', code = 400) {
    super()

    this.message = message
    this.code = code
    Object.setPrototypeOf(this, CustomError.prototype)
  }

  serialize() {
    return {
      code: this.code,
      message: this.message,
      error: null
    }
  }
}


