import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { BaseService } from './base.service.js'

const xlsxPath = '/temp'


if (!fs.existsSync(path.join(process.cwd(), xlsxPath))) {
  fs.mkdirSync(path.join(process.cwd(), xlsxPath))
}

export class XlsxService extends BaseService {

  constructor() {
    super();
  }

  #xlsxFileName = () => crypto.randomBytes(4).toString('hex') + '.xlsx'
  // '/xlsx-temp/'
  #absPath = (filename) => path.join(process.cwd(), xlsxPath, filename)

  #createTemporalExcel = async (data, filename, bookName) => {
    const ws = xlsx.utils.json_to_sheet(data)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, bookName)
    xlsx.writeFile(wb, filename)
  }

  deleteTemporalExcel = async absPath => {
    return new Promise((resolve, reject) => {
      fs.unlink(absPath, err => {
        if (err) {
          //TODO se puede resolver asi tenga error para que no rompa el controlador
          console.log('ocurrio un error elimindo el archivo pero se capturo localmente para que no se rompa el controlador', err)
          return resolve()
          // return reject(err)
        }
        resolve()
      })
    })
  }

  createParkingLotExcel = async data => {

    const fileName = this.#xlsxFileName()
    const absPath = this.#absPath(fileName)

    this.#createTemporalExcel(data, absPath, "Parqueaderos")

    return {absPath}
  }

  createPaymentsExcel = async data => {

    const fileName = this.#xlsxFileName()
    const absPath = this.#absPath(fileName)

    this.#createTemporalExcel(data, absPath, "Parqueaderos")

    return {absPath}
  }

  createLoadExcel = async ( data) => {
    const fileName = this.#xlsxFileName()
    const absPath = this.#absPath(fileName)

    this.#createTemporalExcel(data, absPath, "LoadUsers")

    return {absPath}
  }
}
