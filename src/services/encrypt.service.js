import * as  crypto from 'crypto'
import * as  fs from 'fs'
import * as  bcrypt from 'bcrypt'
import { CustomError } from '../errors/index.js'
/**
 * generate key
 * ssh-keygen -t rsa -b 2048 -m PEM -f app-key.key
 * openssl rsa -in  app-key.key -pubout -outform PEM -out app-key.key.pub
 */
let RSA = {}
if (process.env.ENVIRONMENT !== 'test') {
  RSA = {
    key: fs.readFileSync(`${process.cwd()}/keys/integroApp-jwtRS256.key`, 'utf-8'),
    pub: fs.readFileSync(`${process.cwd()}/keys/integroApp-jwtRS256.key.pub`, 'utf-8')
  }
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY// Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16
const EAS_ALGORITHM ='aes-256-cbc'
const HEX = 'hex'
const SPLITTER = '_'

/**
 *
 */
export class EncryptService {

  constructor() {
    this.RSA = RSA
    //
    this.ENCRYPTION_KEY = ENCRYPTION_KEY
    this.IV_LENGTH = IV_LENGTH
    this.EAS_ALGORITHM = EAS_ALGORITHM
    this.HEX = HEX
    this.SPLITTER = SPLITTER

  }

  publicEncrypt = async data => {

    try {

      if (typeof data !== 'string') {
        data = JSON.stringify(data)
      }

      const encryptedData = crypto.publicEncrypt({
        key: this.RSA.pub,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      }, // We convert the data string to a buffer using `Buffer.from`
        Buffer.from(data))

      // console.log(encryptedData.toString('base64'))
      return encryptedData.toString(HEX)
    } catch (err) {
      console.log('publicEncrypt error ->', err)
      throw err
    }
  }

  privateDecrypt = async hexString => {
    try {

      const buffer = Buffer.from(hexString, HEX)

      let decryptedData = crypto.privateDecrypt({
        key: this.RSA.key, // In order to decrypt the data, we need to specify the
        // same hashing function and padding scheme that we used to
        // encrypt the data in the previous step
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      }, buffer)

      return this.#parseDecryptedData(decryptedData)

    } catch (err) {
      console.log(err)
      throw new CustomError('No se puedo obtener datos')
    }

  }

  #parseDecryptedData = data => {
    if (!(data instanceof Buffer)) {
      throw new Error('data to parse must be instance of Buffer')
    }
    const decryptedData = data.toString('utf-8')
    try {
      return JSON.parse(decryptedData)
    } catch (err) {
      return decryptedData
    }

  }

  hasPassword = async password => {
    const salt = await bcrypt.genSalt(10)
    return bcrypt.hash(password, salt)
  }

  comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash)
  }


  async  encryptEAS(data) {

    try{
      const text = data.toString()
      let iv = crypto.randomBytes(this.IV_LENGTH);
      let cipher = crypto.createCipheriv(this.EAS_ALGORITHM, Buffer.from(this.ENCRYPTION_KEY), iv);
      let encrypted = cipher.update(text);
     
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return  iv.toString(this.HEX) + this.SPLITTER + encrypted.toString(this.HEX)
    } catch(e){

      console.log('encrypt eas error ->', e)
      throw new CustomError('No se puedo cifrar los datos')

    }

  

  }
  
  async  decryptEAS(text) {

    try {
      let textParts = text.split(this.SPLITTER);
      let iv = Buffer.from(textParts.shift(), this.HEX);
      let encryptedText = Buffer.from(textParts.join(this.SPLITTER),this.HEX);
      let decipher = crypto.createDecipheriv(this.EAS_ALGORITHM, Buffer.from(this.ENCRYPTION_KEY), iv);
      let decrypted = decipher.update(encryptedText);
     
      decrypted = Buffer.concat([decrypted, decipher.final()]);
  
      return decrypted.toString()

    }catch (e){
      throw new CustomError('No se puedo obtener datos')
    }
  }
}
