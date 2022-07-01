import {CustomError}  from '../errors/index.js'
import  {logger}  from '../utils/index.js'
/**
 *
 * @param err
 * @param req
 * @param res
 * @param next
 * @returns {Promise<void>}
 */
export async function errorHandler(err, req, res, next) {
  // atrapar el id de la request

  if (err) {
    logger.info(`request: ${req.requestId} body -> ${strinify(req.body)}`)
    logger.info(`request: ${req.requestId} params -> ${strinify(req.params)}`)
    logger.info(`request: ${req.requestId} query -> ${strinify(req.query)}`)
    logger.error(`request: ${req.requestId} error message -> ${err.message}`)
    logger.error(`request: ${req.requestId} error stack -> ${err.stack}`)

    if (err instanceof CustomError) {
      console.log('err instanceof CustomError', err)
      return res.status(err.code).send({ ...err.serialize(), requestId: req?.requestId })
    }

    //res.status(500).send({message: 'To Do error handler...'})

    console.log('Error without handle', err)

    return res.status(500).send({
      err: err.message,
      message: 'Ocurrio un error inesperado.',
      data: null,
      requestId: req?.requestId
    })

  }
  next()
}

function strinify(data) {
  try {
    return JSON.stringify(data)
  } catch (err) {
    return ''
  }
}



