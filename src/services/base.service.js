import * as model from '../models/index.js'
import * as errors from "../errors/index.js";
import * as util from '../utils/index.js'
import sqz from '../db/index.js'
import sequelize from 'sequelize'
import axios from 'axios'
const { Op  } = sequelize
import moment from 'moment'
import { uuid } from 'uuidv4'

import numbro from 'numbro'
import {logger} from "../utils/index.js";


export class BaseService {


  constructor(body, params, query) {

    this.sqz = sqz
    this.model = model
    this.Op = Op
    this.errors = errors
    this.sequelize = sequelize
    this.moment = moment
    this.axios = axios
    this.util = util

    this.body = body
    this.params = params
    this.query = query
    this.uuid = uuid
    this.number = numbro
    this.MAX_FAILED_TRY = 20
    this.MAX_LOGIN_FAILED_TRY = 3
    
  }

  formulaRoundCostConcept = async (value, round) => {
    if (parseFloat(value) < 0){
      return 0
    }
    return Math.round(parseFloat(value) / parseFloat(round)) * parseFloat(round);
  }


  /**
   *
   * This function register in siigo_error all fails in the request API on the diferents methods
   *
   * @param siigo_info || Object
   * @param wihom_info || Object
   * @param method || String
   * @returns {Promise<void>}
   */
  registerError = async (siigo_info = {}, wihom_info = {}, method = '') => {
    try {
      await this.model.SiigoErrorModel.create({
        siigo_info,
        wihom_info,
        method
      })
    } catch (e) {

      let params = {
        siigo_info,
        wihom_info,
        method
      }

      console.error({
        params,
        e
      })

      logger.error(`Register error Siigo: error -> ${e.message} -> params ${this.strinify(params)}`)
    }
  }


  strinify(data) {
    try {
      return JSON.stringify(data)
    } catch (err) {
      return ''
    }
  }

}
