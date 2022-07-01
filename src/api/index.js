import http from 'http'
import express from 'express'
import { config } from '../utils/index.js'
import morgan from 'morgan'
import cors from 'cors'
import { errorHandler, requestIdMiddleware } from '../middleware/index.js'
import * as routes from '../routes/index.js'
import helmet from 'helmet'

export default class Api {
  headers = ['Content-Type', 'Authorization']

  get allowedOrigins() {
    let result = [
      'https://dev.wihom.com.co',
      'http://dev.wihom.com.co',
      'http://qa.wihom.com.co',
      'https://meet.wihom.com.co',
      'https://app.wihom.com.co',
      'http://admin.wihom.com.co/',
      'https://admin.wihom.com.co/',
      'http://admindev.wihom.com.co/',
      'https://wihompay.com',
      'http://wihompay.com',
    ]
    if (process.env.ENVIRONMENT !== 'production') {
      result.push('http://127.0.0.1:4200')
      result.push('http://localhost:4200')

    }
    return result
  }

  constructor() {}

  #init() {
    this.setEnvironment()
    this.app = express()

    this.initializeMiddlewares()
    this.initializeRoutes()
  }

  initializeRoutes() {
    this.app.get('/billing-api', async (req, res) => {
      res.status(200).json({
        title: 'API Billing',
        version: '0.1.6',
        path: '/billing-api'
      })
    })
    // zero down time's endpoint
    this.app.get('/touch', async (req, res) => {
      res.status(200).send( '0.1.1')
    })

    this.app.get('/touch', async (req, res) => {
      res.status(200).send('' )
    })

    this.mountRoutes()
    this.app.use(errorHandler)
  }

  createMorganTokens() {
    // eslint-disable-next-line no-unused-vars
    morgan.token('body', function (req, res) {
      return JSON.stringify(req.body)
    })
  }

  initializeMiddlewares() {

    this.createMorganTokens()
    this.app.use(express.json({limit:'50mb'}))
    this.app.use(express.urlencoded({
      extended: true,
      limit:'50mb'
    }))
    this.app.use(requestIdMiddleware.main)

    const allowedOrigins = this.allowedOrigins

    this.app.use(helmet())
    this.app.use(cors({
      allowedHeaders: this.headers,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      exposedHeaders: this.headers,
      origin: function (origin, callback) {
        console.log('request origin ---->', origin)
        if (process.env.ENVIRONMENT !== 'production') {
          if (!origin) return callback(null, true)
        }
        if (allowedOrigins.indexOf(origin) === -1) {
          // return callback(new errors.CustomError('Acceso no permitido '), false)
        }
        return callback(null, true)
      }
    }))
  }

  initializeServer() {
    this.#init()
    const server = http.createServer(this.app)

    server.listen(parseInt(config.port), () => {
      const {
        port,
        address
      } = server.address();
      console.log(`Server started on => ${address}:${port}`)
    })

    return server
  }

  mountRoutes() {
    // versioned routes
    const v1 = routes.v1()
    for (const route in v1) {
      //console.log(`Router ${route} mounted `)
      this.app.use('/billing-api', v1[route])
    }

    this.#mountDefaultRoute()

  }

  setEnvironment = () => {
    if (!process.env.ENVIRONMENT) throw new Error('process.env.ENVIRONMENT not found')

    if (process.env.ENVIRONMENT === 'production') {
      process.env.APP_DOMAIN = process.env.PROD_APP_DOMAIN
    } else if (process.env.ENVIRONMENT === 'QA') {
      process.env.APP_DOMAIN = process.env.QA_APP_DOMAIN

    } else if (process.env.ENVIRONMENT === 'development') {
      process.env.APP_DOMAIN = process.env.DEV_APP_DOMAIN
    }else {
      process.env.APP_DOMAIN = process.env.LOCAL_APP_DOMAIN
    }

    console.log(`app domain => ${process.env.APP_DOMAIN}`)
  }

  #mountDefaultRoute = () => {
    this.app.all('*', (req, res) => {
      const message = `${req.method} to ${req.get('host')}${req.originalUrl} not found`
      res.status(404).send({message})
    })
  }
}

// module.exports = Index
