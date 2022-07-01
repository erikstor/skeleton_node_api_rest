import aws from 'aws-sdk'
import { BaseService } from './base.service';

// Set the AWS region
const REGION = process.env.AWS_S3_REGION; //e.g. "us-east-1"

// Set the parameters
// const uploadParams = {
//   Bucket: process.env.AWS_S3_BUCKET,
//   Key: 'KEY',
//   Body: 'BODY'
// }; //BUCKET_NAME, KEY (the name of the selected file),


class S3UploadService extends BaseService{
  _s3 =  new aws.S3({ region: REGION })

  constructor(file) {
    super()
    this._uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${process.env.AWS_S3_CONTEXT}${new Date().getTime()}${file?.originalname || ''}`,
      Body: file?.buffer,
      ACL: 'public-read'
    }
  }

  upload = async () => {

    try {
      const data = await this._putObject()
      const fileName = this._uploadParams.Key.replace(/\s/g, '%20')

      return {
        query: this._uploadParams,
        response: data,
        url: `https://${ process.env.AWS_S3_BUCKET }.${ process.env.AWS_S3_DOMAIN }/${ fileName }`,
        fileName: this._uploadParams.Key
      }
    } catch (err) {
      console.log('Error', err)
      throw new this.errors.UploadFileError(err)
    }
  }

  /**
   * delete file form aws s3 by file name
   * @param {} fileName 
   */
  delete = async (fileName) => {
    const params = { Bucket: process.env.AWS_S3_BUCKET,Key: fileName}
     return  this._s3.deleteObject(params).promise()
  }

  _putObject = async () => {
   return  this._s3.putObject(this._uploadParams).promise()
   /*
    return new Promise((resolve, reject) => {
      this._s3.putObject(this._uploadParams, (err, data) => {

        if (err) reject(err)
        resolve(data)
      })
    })
    */

  }
}

module.exports = S3UploadService
