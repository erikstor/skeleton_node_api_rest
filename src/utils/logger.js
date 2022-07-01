import winston from 'winston'
// require('winston-daily-rotate-file')
// import * as DailyRotateFile from  'winston-daily-rotate-file'
import 'winston-daily-rotate-file'

class Logger {
  constructor() {
    this.logger = this.createLogger()
  }
  createLogger() {
    const infoTransport = new  winston.transports.DailyRotateFile({
      filename: 'logs/info_%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      level: 'info'
    });

    const errorTransport = new  winston.transports.DailyRotateFile({
      filename: 'logs/error_%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      level: 'error'
    });

    return winston.createLogger({
      transports: [
        infoTransport,
        errorTransport
      ]
    })
  }
  info(message) {
    this.logger.info(message)
  }

  error(message) {
    this.logger.error(message)
  }
}

export const logger = new Logger()

