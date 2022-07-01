import { validationResult }  from  'express-validator'
import  { RequestValidationError }  from '../errors/index.js'

export const validateRequest = (req, res, next) => {

  console.log('validateRequest')
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    let _errors = []
    for (const e of errors.array()) {
      if (e.nestedErrors) {
        _errors = [ ..._errors, ...e.nestedErrors ]
      } else {
        _errors.push(e)

      }
    }

    console.log(_errors)
    return next(new RequestValidationError(_errors))
  }
  next()

}


