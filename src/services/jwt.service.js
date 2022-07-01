import fs from 'fs'
import jwt from 'jsonwebtoken'

/**
 * generate key
 * ssh-keygen -t rsa -b 2048 -m PEM -f jwtRS256.key
 * openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
 */

/**
 *
 */
const JWT_OPTIONS = {
  expiresIn: '12h',
  algorithm: 'RS512',
  noTimestamp: true
}
/**
 *
 */
const JWT_VERIFY_OPTIONS = {
  algorithms: ['RS512']
}

/**
 *
 */
const JWT_DECODE_OPTIONS = {
  complete: false,
  json: false
}
// para test esto no puede quedar asi debe estar dentro de un if de variable de entorno
let RSA = {}
if (process.env.ENVIRONMENT !== 'test') {
  RSA = {
    key: fs.readFileSync(`${process.cwd()}/keys/integroApp-jwtRS256.key`, 'utf-8'),
    pub: fs.readFileSync(`${process.cwd()}/keys/integroApp-jwtRS256.key.pub`, 'utf-8')
  }

}


export class JWTService {

  constructor(expiresIn) {
    this.RSA = RSA
    this.JWT_OPTIONS = JWT_OPTIONS
    this.JWT_OPTIONS.expiresIn = expiresIn || JWT_OPTIONS.expiresIn
    this.JWT_VERIFY_OPTIONS = JWT_VERIFY_OPTIONS

  }

  async sign(r) {
    return new Promise((resolve, reject) => {
      jwt.sign(r, this.RSA.key, this.JWT_OPTIONS, (err, token) => {
        // console.log(token)
        if (err) {
          reject(err)
        }

        resolve(token)
      })
    })
  }

  async verify(token) {
    // console.log(token)
    return new Promise((resolve, reject) => {
      // console.log('RSA_PRIVATE_KEY', RSA)
      jwt.verify(token, this.RSA.pub, this.JWT_VERIFY_OPTIONS, (err, decoded) => {
        if (err) {
          reject(err)
        }
        // if (err) { resolve(undefined) }
        // console.log(decoded, new Date(decoded.exp * 1000)) // bar
        resolve(decoded)
      })
    })
  }

}


