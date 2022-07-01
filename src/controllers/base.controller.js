import fs from 'fs'
import moment from 'moment'

import * as errors from "../errors/index.js";
import * as services from "../services/index.js";
import sqz from '../db/index.js'
import numbro from 'numbro'

export class BaseController {
  constructor() {
    this.services = services
    this.errors = errors
    this.sqz = sqz
    this.moment = moment
    this.number = numbro

  }

  downloadFile = async (res, absPath, unlink = false) => {
    return new Promise((resolve, reject) => {
      res.download(absPath, (err) => {
        if (err) {
          // return 500
          console.log("error downloading file...", err);
          reject(
            new this.errors.CustomError(
              "error download file..",
              this.errors.CODES.INTERNAL_SERVER_ERROR
            )
          );
        }
        resolve();
        if(unlink) {
          fs.unlink(absPath, (err) => {
            if (err) {
              console.log("error deleting file...", err);
            }
          });
        }
      });
    });
  };

  /**
   * delay en milisegundos
   * @param ms
   * @returns {Promise<unknown>}
   */
  delay = ms => new Promise(resolve => setTimeout(resolve, ms))
}
