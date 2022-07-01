import sequelize from 'sequelize'

import  {logger} from '../utils/index.js'

let dbConfig = {
  database: '',
  host: 'localhost',
  password: '',
  port: 5432,
  user: '',
  pool: {
    acquire: Number(process.env.PG_POOL_ACQUIRE) || 30000,
    idle: Number(process.env.PG_POOL_IDLE) || 10000,
    max: Number(process.env.PG_POOL_MAX) || 5,
    min: Number(process.env.PG_POOL_MIN) || 0
  },
  dialect: 'postgres'
}

switch (process.env.ENVIRONMENT) {
  case 'development':
    dbConfig = {
      ...dbConfig,
      host: process.env.PG_DEV_HOST,
      port: Number(process.env.PG_DEV_PORT),
      user: process.env.PG_DEV_USER || '',
      database: process.env.PG_DEV_DATABASE || '',
      password: process.env.PG_DEV_PASSWORD || ''
    }
    break;
  case 'production':
    dbConfig = {
      ...dbConfig,
      host: process.env.PG_PROD_HOST,
      port: Number(process.env.PG_PROD_PORT),
      user: process.env.PG_PROD_USER || '',
      database: process.env.PG_PROD_DATABASE || '',
      password: process.env.PG_PROD_PASSWORD || ''
    }
    break
  case 'QA':
    dbConfig = {
      ...dbConfig,
      host: process.env.PG_QA_HOST,
      port: Number(process.env.PG_QA_PORT),
      user: process.env.PG_QA_USER || '',
      database: process.env.PG_QA_DATABASE || '',
      password: process.env.PG_QA_PASSWORD || ''
    }
    break;
  default:
    dbConfig = {
      ...dbConfig,
      host: process.env.PG_LOCAL_HOST,
      port: Number(process.env.PG_LOCAL_PORT),
      user: process.env.PG_LOCAL_USER || '',
      database: process.env.PG_LOCAL_DATABASE || '',
      password: process.env.PG_LOCAL_PASSWORD || ''
    }
    break;
}

console.log('Environment =>', process.env.ENVIRONMENT || 'local')
console.log(`database connection on => ${dbConfig.host}: ${dbConfig.port}`)

let instance

function getDb() {
  if (!instance) {
    // en este punto se están sobreescribiendo algunas propiedades que no deberían.
    instance = new sequelize.Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
      host: dbConfig.host || '',
      dialect: dbConfig.dialect,
      port: dbConfig.port || 6432,
      pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
      },
      logging: msg => {
        //console.log(msg)
        // logger.info(msg)
      }
    })

  }
  return instance
}
/**
 *
 * @type {Sequelize}
 */
export default getDb()
// export default new sequelize.Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
//   host: dbConfig.host || '',
//   dialect: dbConfig.dialect,
//   port: dbConfig.port || 6432,
//   pool: {
//     max: dbConfig.pool.max,
//     min: dbConfig.pool.min,
//     acquire: dbConfig.pool.acquire,
//     idle: dbConfig.pool.idle
//   },
//   logging: msg => {
//      //console.log(msg)
//     // logger.info(msg)
//   }
// })


