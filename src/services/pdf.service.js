import { BaseService } from './base.service.js'
import pdfmake from 'pdfmake'
import crypto from "crypto";
import path from "path";
import fs from 'fs'
const tempPath = '/temp'


/* pdfmake.fonts = {
  Lato: {
    normal: '',
    bold: 'https://cdnjs.cloudflare.com/ajax/libs/lato-font/3.0.0/fonts/lato-bold/lato-bold.woff',
    italics: 'https://cdnjs.cloudflare.com/ajax/libs/lato-font/3.0.0/fonts/lato-light-italic/lato-light-italic.woff',
    bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/lato-font/3.0.0/fonts/lato-bold-italic/lato-bold-italic.woff'
  }
}  */


export class PdfService extends BaseService {

  tableLayouts = {
    wihomLayout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      vLineColor: () => '#8187BB',
      hLineColor: () => '#8187BB',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6
    },
    noPadding: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    line: {
      hLineColor: () => '#8187BB',
      hLineWidth: (i, node) => {
        return (i === 0 || i === node.table.body.length) ? 0 : 1
      },
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    }
  }
  FONTS = {
    Courier: {
      normal: 'Courier',
      bold: 'Courier-Bold',
      italics: 'Courier-Oblique',
      bolditalics: 'Courier-BoldOblique'
    },
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    },
    Times: {
      normal: 'Times-Roman',
      bold: 'Times-Bold',
      italics: 'Times-Italic',
      bolditalics: 'Times-BoldItalic'
    },
    Symbol: {
      normal: 'Symbol'
    },
    ZapfDingbats: {
      normal: 'ZapfDingbats'
    },
     Lato: {
      normal: `${process.cwd()}/src/utils/fonts/lato-normal.woff`,
      bold: `${process.cwd()}/src/utils/fonts/lato-bold.woff`,
      italics: `${process.cwd()}/src/utils/fonts/lato-light-italic.woff`,
      bolditalics: `${process.cwd()}/src/utils/fonts/lato-bold-italic.woff`
    } 
  };
  constructor() {
    super()
    this.pdfMake = pdfmake
  }


  pdfBuffer = async (data, fonts = this.FONTS) =>{

    
    return new Promise((resolve, reject) => {

      const printer = new pdfmake(fonts)

      const chunks = []

      let pdfDoc = printer.createPdfKitDocument(data)

      pdfDoc.on('data', data =>{
        chunks.push(data)
      })

      pdfDoc.on('end',  () => {
        resolve(Buffer.from(Buffer.concat(chunks)))
      })

      pdfDoc.on("error", err =>{
        reject(err)
      });
      pdfDoc.end()

    })
    

  }
  pdfBufferInvoice = async (data, fonts = this.FONTS) =>{

    
    return new Promise((resolve, reject) => {

      const printer = new pdfmake(fonts)

      const chunks = []

      let pdfDoc = printer.createPdfKitDocument(data, {tableLayouts: this.tableLayouts})

      pdfDoc.on('data', data =>{
        chunks.push(data)
      })

      pdfDoc.on('end',  () => {
        resolve(Buffer.from(Buffer.concat(chunks)))
      })

      pdfDoc.on("error", err =>{
        reject(err)
      });
      pdfDoc.end()

    })
    

  }
  
  invoice =  async (data, watermark) => {
    return this.generateInvoicePdf(data)
    //return this.invoiceWatermark(data, watermark)
    
  }
  /*****************************************************************/
  /** INICIO CODIGO NUEVO DISEÑO PARA LA FACTURA DEL CORREO (PDF) */
  /*****************************************************************/
  generateInvoicePdf(data) {
    const images = data.images
    return this.pdfBufferInvoice({
        pageSize: 'LETTER',
        content: this.getPdfContent(data),
        defaultStyle: { fontSize: 12, bold: false, font: 'Lato' },
        pageMargins: [ 30, 30, 30, 69 ],
        'styles': {
          name: { fontSize: 16, bold: true },
          title: { fontSize: 12, bold: true },
          content: { fontSize: 12 }
        },
        images: {
          logo: data.project.logo,
          mastercard: images.mastercard,
          visa: images.visa,
          pse: images.pse,
          wihomLogo: images.wihomLogo,
          wihomPay: images.wihomPay,
        },
        footer: (currentPage, pageCount, pageSize) => { return this.generateFooter(pageSize) }
      })

 /*      generator.getBase64((base64) => {
        resolve(base64)
      }) */
    

  }
  /**
   * Genera el contenido del pdf
   */
   getPdfContent(data) {
    return [
      {
        columns: [
          [
            this.generateInfoRow(data),
            this.generateDataTable(data.concepts),
            this.generateTotalValue(data.total, data.credit_balance_applied, data.discounts.length),
            this.generateDiscounts(data.discounts),
            this.generatePayButton(data.payment_link),
            this.generatePaymentMethodInfo(),
            this.generateMessage(data.comment)
          ]
        ]
      }]}
      /**
   * Row de la informacion de la factura
   * @returns
   */
  generateInfoRow(data) {
    let titleCanvas = { type: 'rect', x: 0, y: 0, w: 200, h: 30, color: '#191D4D', lineColor: '#191D4D', }
    let dataCanvas = { type: 'rect', x: 0, y: 0, w: 400, h: 70, color: '#E7E8F6', lineColor: '#E7E8F6', }
    let title = { text: 'Datos de factura', width: 200, color: '#FFFFFF', alignment:'center', noWrap: true, bold: true }
    return {
      width: '*',
      layout: 'noBorders',
      margin: [0, 0, 0, 20],
      table: {
        headerRows: 0,
        widths: [ 400, '*'],
        body: [
          [
            // info
            {
              stack: [
                { canvas: [{...titleCanvas, r: 5}]},
                { columns:[title], relativePosition: { y: -25 }, style:{ fontSize: 14, bold:true } },
                { canvas: [dataCanvas], relativePosition: { y: -4 }},
                { canvas: [{...dataCanvas, r: 5, w: 410, h: 100}], relativePosition: { y: -4 }},
                {
                  width: '*',
                  margin: [15, 8, 15, 15],
                  columns: [
                    [
                      { text: data.real_state.name, style: 'name' },
                      {
                        layout: 'noBorders',
                        table: {
                          headerRows: 0,
                          widths: [200 , 200],
                          body: [
                            [
                              { text: [ {text: 'Inmueble: ', style: 'title'}, {text: data.real_state.address, style: 'content'} ] },
                              { text: [ {text: 'Cuenta de cobro: ', style: 'title'}, {text: data.code, style: 'content'} ] }
                            ],
                            [
                              { text: [ {text: 'Mes de facturación: ', style: 'title'}, {text: data.date.month, style: 'content'} ] },
                              { text: [ {text: 'Código: ', style: 'title'}, {text: data.real_state.code, style: 'content'} ] }
                            ],
                            [
                              { text: [ {text: 'Fecha: ', style: 'title'}, {text: data.date.currentDate, style: 'content'} ] },
                              { text: [ {text: 'Coeficiente: ', style: 'title'}, {text: data.real_state.ratio, style: 'content'} ] }
                            ],
                          ]
                        }
                      }
                    ]
                  ]
                }
              ]
            },
            // logo project
            this.generateProjectData(data.project)
          ]
        ]
      }
    }
  }

  /**
   * Genera el logo del proyecto
   * @param project
   * @returns
   */
  generateProjectData(project) {
    return {
      margin: [0, 20, 0, 0],
      columns: [
        [
          { image: 'logo', width: 80, height: 60, alignment: 'center' },
          { text: project.name, alignment: 'center', style: 'title'},
          { text: 'Teléfono: ' + project.phone_number, alignment: 'center', style: 'content'},
          { text: project.address, alignment: 'center', style: 'content'},
        ]
      ],
    }
  }


  generateDataTable(concepts) {
    let titleCanvas = { type: 'rect', x: 0, y: 0, w: 552, h: 25, color: '#8187BB', lineColor: '#8187BB', }
    let title = { text: 'Descripción del pago', width: '*', color: '#FFFFFF', alignment:'center', noWrap: true, bold: true }
    const rows = Array.isArray(concepts) ? concepts.map(concept => {
      const isBold = concept.name === 'Saldo a favor del propietario'
      return [
        { text: concept.name, style: 'content', bold: isBold },
        { text: concept.debt, style: 'content' },
        { text: concept.price, style: 'content' },
        { text: concept.total, style: 'content', bold: isBold }
      ]
    }) : []
    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 0,
        widths: [ '*' ],
        body: [
          [
            // info
            {
              stack: [
                { canvas: [{...titleCanvas, r: 5}]},
                { canvas: [{...titleCanvas, h: 5}], relativePosition: { y: -4 }},
                { columns: [title], relativePosition: { y: -21 }, style:{ fontSize: 14, bold: true } },
              ]
            },
          ],
          [
            {
              width: '*',
              layout: 'wihomLayout',
              table: {
                headerRows: 1,
                widths: [ 180, '*', '*', '*' ],
                body: [
                  [{ text: 'Concepto', style: 'title' }, { text: 'Saldos pendientes', style: 'title' }, { text: 'Mes actual', style: 'title' }, { text: 'Valor total', style: 'title' }],
                  ...rows
                ]
              }
            }
          ]
        ]
      }
    }
  }

  generateTotalValue(total, creditBalanceApplied = false, discountsAmount = 0) {
    let totalCanvas = { type: 'rect', x: 0, y: 0, w: 352, h: !creditBalanceApplied && discountsAmount > 0 ? 40 : 60, color: '#8187BB', lineColor: '#8187BB', }
    let totalValue = creditBalanceApplied ? [
      [
        {
          columns: [
            {text: 'Total a pagar', style: 'content', color: '#FFFFFF', alignment:'right', width: 230},
            {text: total, style: 'title', fontSize: 14, color: '#FFFFFF', alignment:'center'},
          ]
        },
        {
          columns: [
            {text: 'Se aplicado tu saldo a favor al valor total de tu factura', fontSize: 8, color: '#FFFFFF', width: 230, alignment:'right'},
            ''
          ]
        },
      ],

    ] : [
      {text: 'Total a pagar', style: 'content', color: '#FFFFFF', alignment:'right'},
      {text: total, style: 'title', fontSize: 14, color: '#FFFFFF', alignment:'center'}
    ]

    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 0,
        widths: [ 200, '*' ],
        body: [
          [
            '',
            // info
            {
              stack: [
                { canvas: [{...totalCanvas, r: 5}]},
                {
                  columns: [
                    ...totalValue
                  ],
                  relativePosition: { y: totalCanvas.h === 40 ? -28 : creditBalanceApplied ? -43 : -38 }
                },
              ]
            },
          ]
        ]
      }
    }
  }

  generateDiscounts(discounts) {
    const canvasRound = { type: 'rect', x: 0, y: 0, w: 552, h: 40, r: 5, color: '#FFFFFF', lineColor: '#8187BB' }
    const canvasValue = { type: 'rect', x: 400, y: 0, w: 152, h: 40, r: 5, color: '#8187BB', lineColor: '#8187BB' }
    const canvasRect = {...canvasValue, w: 50, r: 0 }
    let canvasDiscounts = []
    if(Array.isArray(discounts)) {
      canvasDiscounts = discounts.map(discount => {
        return {
          margin: [0, 30, 0, 20],
          stack: [
            { canvas: [{...canvasRound}], relativePosition: { y: 0, x: 0 }, },
            { canvas: [{...canvasValue}], relativePosition: { y: 0, x: 0 }, },
            { canvas: [{...canvasRect}], relativePosition: { y: 0, x: 0 }, },
            { columns: [
                { text: `Obtén ${discount.percentage} de descuento pagando durante los primeros ${discount.days} días del mes`, fontSize: 12, width: 400, margin: [0, 5, 10, 0] },
                {
                  columns: [
                    [
                      { text: 'Valor con descuento', fontSize: 12, color: '#FFFFFF', alignment: 'center' },
                      { text: discount.valueWithDiscount, fontSize: 12, color: '#FFFFFF', bold: true, alignment: 'center' },
                    ]
                  ],
                  relativePosition: { y: -4, x: -8 }
                }
              ],
              relativePosition: { y: 8, x: 10 }
            }
          ]
        }
      })
    }

    return {
      columns: [
        [...canvasDiscounts]
      ]
    }
  }

  generatePayButton(link) {
    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 0,
        widths: [ 200, '*' ],
        body: [
          [
            '',
            {
              margin: [0, 10, 0, 0],
              columns: [
                { image: 'wihomPay', width: 200, height: 40, alignment: 'left' },
                this.makeTag('Pagar ahora', 130, link)
              ]
            }
          ]
        ]
      }
    }
  }

  makeTag(text, width = 200, link = '') {
    let canvas = { type: 'rect', x: 0, y: 0, w: width, h: 25, r: 15, color: '#EE7A14', lineColor: '#EE7A14', }
    let column = { text, width, color: '#FFFFFF', alignment:'center', noWrap: true, bold:true, link }
    return {
      stack: [
        { canvas: [canvas], relativePosition: { y: 10, x: 15 }, },
        { columns: [column],
          relativePosition: { y: 14, x: 15 },
          style:{ fontSize: 14, bold:true }
        }
      ]
    }
  }

  generatePaymentMethodInfo() {
    let canvas = { type: 'rect', x: 0, y: 0, w: 552, h: 60, r: 5, color: '#FFFFFF', lineColor: '#8187BB' }
    return {
      margin: [0, 10, 0, 60],
      stack: [
        { canvas: [canvas], relativePosition: { y: 0, x: 0 }, },
        { columns: [
            { text: 'Paga tu factura en línea de manera rápida y segura, con el medio de pago de tu preferencia.', fontSize: 14, width: 400, margin: [0, 5, 10, 0] },
            {image: 'pse', width: 35, height: 35, alignment:'right', margin: [0, 3, 0, 0]},
            {image: 'visa', width: 45, height: 15, alignment:'right', margin: [0, 12, 0, 15]},
            {image: 'mastercard', width: 40, height: 30, alignment:'right', margin: [0, 5, 0, 15]}
          ],
          relativePosition: { y: 8, x: 10 }
        }
      ]
    }
  }

  generateMessage(message) {
    return {
      margin: [0, 60, 0, 0],
      columns: [
        [
          { text: 'Mensaje:', style: 'content' },
          { text: message, style: 'content' },
        ]
      ]
    }
  }

  generateFooter(pageSize) {
    return {
      columns: [
        [
          { margin: [30, 0, 0, 0], table: { widths: [pageSize.width - 60], body: [[''], ['']] }, layout: 'line' }, // line
          {
            margin: [pageSize.width - 195, 0, 0, 0],
            columns: [
              { margin: [0, 5, 0, 5], text: 'Powered by', fontSize: 8, alignment: 'right', width: 100, bold: false},
              { image: 'wihomLogo', width: 60, height: 17, alignment: 'left', margin: [5, 2, 0, 0] }
            ]
          },
          {
            margin: [0, 28, 0, 0],
            canvas: [
              { type: 'rect', w: pageSize.width / 2, h: 20, x: 0, y: 0, color: '#191D4D', lineColor: '#191D4D' },
              { type: 'rect', w: pageSize.width / 2, h: 20, x: pageSize.width / 2, y: 0, color: '#EE7A14', lineColor: '#EE7A14' }
            ]
          }
        ]
      ]
    }

  }


  /*************************************************************/    
  /** FIN CODIGO NUEVO DISEÑO PARA LA FACTURA DEL CORREO (PDF) */
  /*************************************************************/



  /*****************************************************************/
  /** INICIO CODIGO DISEÑO PARA COMPROBANTE DE PAGO POR CORREO (PDF) */
  /*****************************************************************/

  payment =  async (data) => {
    return this.generatePaymentPdf(data) 
  }

  generatePaymentPdf(data) {
    return this.pdfBufferInvoice({
        pageSize: 'LETTER',
        content: this.getPdfPaymentContent(data),
        defaultStyle: { fontSize: 12, bold: false, font: 'Lato' },
        pageMargins: [ 30, 30, 30, 69 ],
        'styles': {
          name: { fontSize: 16, bold: true },
          title: { fontSize: 12, bold: true },
          content: { fontSize: 12 }
        },
        images: {
          logo: data.project.logo,
          mastercard: data.images.mastercard,
          visa: data.images.visa,
          pse: data.images.pse,
          wihomPay: data.images.wihomPay,
          wihomLogo: data.images.wihomLogo,
          // TODO: cambiar la imagen pse por la nueva que envie por parametro
          successIco: data.images.okLogo
        },
        footer: (currentPage, pageCount, pageSize) => { return this.generateFooter(pageSize) }
      })

/*       generator.getBase64((base64) => {
        resolve(base64)
      }) */
    
  }


  getPdfPaymentContent(data) {
    return [
      {
        columns: [
          [
            this.generateInfoRowPayment(data),
            this.generateTransactionInfoPayment(),
            this.generateDataTablePayment(data.concepts),
            this.generateTotalValuePayment(data.total, data.credit_balance_applied, data.discounts.length),
            this.generateDiscountsPayment(data.discounts),
            this.generatePayButtonPayment(data.payment_link),
            this.generatePaymentMethodInfoPayment(data.discounts.length),
            this.generateMessage(data.comment)
          ]
        ]
      }
    ]
  }


  generateInfoRowPayment(data) {
    let titleCanvas = { type: 'rect', x: 0, y: 0, w: 200, h: 30, color: '#191D4D', lineColor: '#191D4D', }
    let dataCanvas = { type: 'rect', x: 0, y: 0, w: 400, h: 70, color: '#E7E8F6', lineColor: '#E7E8F6', }
    let title = { text: 'Comprobante de pago', width: 200, color: '#FFFFFF', alignment:'center', noWrap: true, bold: true }
    return {
      width: '*',
      layout: 'noBorders',
      margin: [0, 0, 0, 20],
      table: {
        headerRows: 0,
        widths: [ 400, '*'],
        body: [
          [
            // info
            {
              stack: [
                { canvas: [{...titleCanvas, r: 5}]},
                { columns:[title], relativePosition: { y: -25 }, style:{ fontSize: 14, bold:true } },
                { canvas: [dataCanvas], relativePosition: { y: -4 }},
                { canvas: [{...dataCanvas, r: 5, w: 420, h: 110}], relativePosition: { y: -4 }},
                {
                  width: '*',
                  margin: [14, 8, 15, 15],
                  columns: [
                    [
                      { text: data.real_state.name, style: 'name' },
                      {
                        layout: 'noBorders',
                        table: {
                          headerRows: 0,
                          widths: [200 , 200],
                          body: [
                            // TODO: Agregar los valores correspondientes a la info
                            [
                              { text: [ {text: 'Inmueble: ', style: 'title'}, {text: data.real_state.address, style: 'content'} ] },
                              { text: [ {text: 'Factura: ', style: 'title'}, {text: data.code, style: 'content'} ] }
                            ],
                            [
                              { text: [ {text: 'Fecha: ', style: 'title'}, {text: data.date.currentDate, style: 'content'} ] },
                              { text: [ {text: 'Método de pago: ', style: 'title'}, {text: data.paymentMethod, style: 'content'} ] }
                            ],
                            [
                              { text: [ {text: 'Referencia: ', style: 'title'}, {text: data.paymentRef, style: 'content'} ] },
                              { text: [ {text: 'Autorizador: ', style: 'title'}, {text: data.auth, style: 'content'} ] }
                            ],
                          ]
                        }
                      }
                    ]
                  ]
                }
              ]
            },
            // logo project
            this.generateProjectDataPayment(data.project)
          ]
        ]
      }
    }
  }

  generateProjectDataPayment(project) {
    return {
      margin: [0, 20, 0, 0],
      columns: [
        [
          { image: 'logo', width: 80, height: 60, alignment: 'center' },
          { text: project.name, alignment: 'center', style: 'title'},
          { text: 'Teléfono: ' + project.phone_number, alignment: 'center', style: 'content'},
          { text: project.address, alignment: 'center', style: 'content'},
        ]
      ],
    }
  }

  generateTransactionInfoPayment() {
    let contentCanvas = { type: 'rect', x: 0, y: 0, w: 552, h: 50, color: '#191D4D', lineColor: '#191D4D' }
    let totalValue = [
      {image: 'successIco', width: 35, height: 35, alignment: 'center', relativePosition: { y: -12.5, x: 7.5 } },
      {text: 'TU TRANSACCIÓN HA SIDO APROBADA', style: 'content', color: '#FFFFFF', alignment:'left', relativePosition: { x: 12 }},
    ]

    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 0, 0, 0],
      table: {
        headerRows: 0,
        widths: [ '*' ],
        body: [
          [
            {
              stack: [
                { canvas: [{...contentCanvas, r: 5}]},
                {
                  columns: [
                    ...totalValue
                  ],
                  relativePosition: { y: -30 }
                },
              ]
            },
          ]
        ]
      }
    }
  }

  generateDataTablePayment(concepts) {
    let titleCanvas = { type: 'rect', x: 0, y: 0, w: 552, h: 25, color: '#8187BB', lineColor: '#8187BB', }
    let title = { text: 'Descripción del pago', width: '*', color: '#FFFFFF', alignment:'center', noWrap: true, bold: true }
    const rows = Array.isArray(concepts) ? concepts.map(concept => {
      const isBold = concept.name === 'Saldo a favor del propietario' || 'Subtotal'
      return [
        // TODO: Agregar el valor de la columna de los saldos restantes
        { text: concept.name, style: 'content', bold: isBold },
        { text: concept.balance, style: 'content' },
        { text: concept.price, style: 'content' }, 
        { text: concept.total, style: 'content', bold: isBold },
        { text: concept.debt, style: 'content' }
      ]
    }) : []
    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 0,
        widths: [ '*' ],
        body: [
          [
            // info
            {
              stack: [
                { canvas: [{...titleCanvas, r: 5}]},
                { canvas: [{...titleCanvas, h: 5}], relativePosition: { y: -4 }},
                { columns: [title], relativePosition: { y: -21 }, style:{ fontSize: 14, bold: true } },
              ]
            },
          ],
          [
            {
              width: '*',
              layout: 'wihomLayout',
              table: {
                headerRows: 1,
                widths: [ 150, '*', '*', '*', '*' ],
                body: [
                  [{ text: 'Concepto', style: 'title' }, { text: 'Saldos pendientes', style: 'title' }, { text: 'Mes actual', style: 'title' }, { text: 'Valor total', style: 'title' }, { text: 'Saldos restantes', style: 'title' }],
                  ...rows
                ]
              }
            }
          ]
        ]
      }
    }
  }

  generateTotalValuePayment(total, creditBalanceApplied = false, discountsAmount = 0) {
    let totalCanvas = { type: 'rect', x: 0, y: 0, w: 352, h: !creditBalanceApplied && discountsAmount > 0 ? 40 : 60, color: '#8187BB', lineColor: '#8187BB', }
    let totalValue = creditBalanceApplied ? [
      [
        {
          columns: [
            {text: 'Total pagado', style: 'content', color: '#FFFFFF', alignment:'right', width: 230},
            {text: total, style: 'title', fontSize: 14, color: '#FFFFFF', alignment:'center'},
          ]
        },
        {
          columns: [
            {text: 'Se aplicado tu saldo a favor al valor total de tu factura', fontSize: 8, color: '#FFFFFF', width: 230, alignment:'right'},
            ''
          ]
        },
      ],

    ] : [
      {text: 'Total pagado', style: 'content', color: '#FFFFFF', alignment:'right'},
      {text: total, style: 'title', fontSize: 14, color: '#FFFFFF', alignment:'center'}
    ]

    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 0,
        widths: [ 200, '*' ],
        body: [
          [
            '',
            // info
            {
              stack: [
                { canvas: [{...totalCanvas, r: 5}]},
                {
                  columns: [
                    ...totalValue
                  ],
                  relativePosition: { y: totalCanvas.h === 40 ? -28 : creditBalanceApplied ? -43 : -38 }
                },
              ]
            },
          ]
        ]
      }
    }
  }


  generateDiscountsPayment(discounts) {
    const canvasRound = { type: 'rect', x: 0, y: 0, w: 552, h: 40, r: 5, color: '#FFFFFF', lineColor: '#8187BB' }
    const canvasValue = { type: 'rect', x: 400, y: 0, w: 152, h: 40, r: 5, color: '#8187BB', lineColor: '#8187BB' }
    const canvasRect = {...canvasValue, w: 50, r: 0 }
    let canvasDiscounts = []
    if(Array.isArray(discounts)) {
      canvasDiscounts = discounts.map(discount => {
        return {
          margin: [0, 30, 0, 20],
          stack: [
            { canvas: [{...canvasRound}], relativePosition: { y: 0, x: 0 }, },
            { canvas: [{...canvasValue}], relativePosition: { y: 0, x: 0 }, },
            { canvas: [{...canvasRect}], relativePosition: { y: 0, x: 0 }, },
            { columns: [
                { text: `Obtén ${discount.percentage}% de descuento pagando durante los primeros ${discount.days} días del mes`, fontSize: 12, width: 400, margin: [0, 5, 10, 0] },
                {
                  columns: [
                    [
                      { text: 'Valor con descuento', fontSize: 12, color: '#FFFFFF', alignment: 'center' },
                      { text: discount.valueWithDiscount, fontSize: 12, color: '#FFFFFF', bold: true, alignment: 'center' },
                    ]
                  ],
                  relativePosition: { y: -4, x: -8 }
                }
              ],
              relativePosition: { y: 8, x: 10 }
            }
          ]
        }
      })
    }

    return {
      columns: [
        [...canvasDiscounts]
      ]
    }
  }


  generatePayButtonPayment(link) {
    return {
      width: '*',
      layout: 'noPadding',
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 0,
        widths: [ 200, '*' ],
        body: [
          [
            '',
            {
              margin: [0, 10, 0, 0],
              columns: [
                { image: 'wihomPay', width: 200, height: 40, alignment: 'left' }
              ]
            }
          ]
        ]
      }
    }
  }
  generatePaymentMethodInfoPayment(discounts) {
    let canvas = { type: 'rect', x: 0, y: 0, w: 552, h: 60, r: 5, color: '#FFFFFF', lineColor: '#8187BB' }
    let canvasWhite = { type: 'rect', x: 0, y: 0, w: 552, h: discounts > 1 ? 30 : 10, r: 0, color: '#FFFFFF', lineColor: '#FFFFFF' }    
    return {
      margin: [0, 0, 0, 60],
      stack: [
        { canvas: [canvasWhite] },
        { canvas: [canvas], relativePosition: { y: 0, x: 0 }, },
        {
          columns: [
            { text: 'Tu pago se ha procesado correctamente a través de Wihom Pay. Gracias por utilizar nuestros servicios.', fontSize: 14, width: 530, margin: [0, 5, 10, 15] },
            /* {image: 'pse', width: 35, height: 35, alignment:'right', margin: [0, 3, 0, 0]},
            {image: 'visa', width: 45, height: 15, alignment:'right', margin: [0, 12, 0, 15]},
            {image: 'mastercard', width: 40, height: 30, alignment:'right', margin: [0, 5, 0, 15]} */
          ],
          relativePosition: { y: 8, x: 10 }
        }
      ]
    }
  }

  /* *
   * Genera la factura
   * @param data Contenido a mostrar en el pdf
   */
  /* generatePaymentPdf(data){
    return this.pdfBuffer({
        pageSize: 'LETTER',
        content: this.getPdfPaymentContent(data),
        defaultStyle: { 
          font:'Helvetica',
          fontSize: 12,
          bold: false },
        pageMargins: [ 30, 15, 30, 69 ],
        images: {
          logo: data.project.logo,
        }
      }, this.FONTS)
  }
 */
 /**
   * Genera el contenido del pdf PAYMENT
   */
 /* getPdfPaymentContent(data) {
    return [
      {
        columns: [
          [
            this.generateProjectDataPayment(data.project), 
            this.generateDatePaymt(data.info),
            this.generatePaymentPropertyData(data.real_state),
            this.generateLinePaymnt(),
            this.generatePaymentList(data.payments),
            this.generateLinePaymnt(),
            this.generateNote(data.info),
            this.generateSealRect(),
            this.generateSealPayment(),
            this.generateSealDate(data.info)
          ]
        ]
      }
    ]
  }

  generateProjectDataPayment(project) {
    return {
        columns: [{
                image: 'logo',
                width: 80,
                height: 60,
            },
            [{
                    text: project.name,
                    alignment: 'center',
                    bold: true
                },
                {
                    text: project.nit,
                    alignment: 'center',
                },
                {
                    text: project.address,
                    alignment: 'center',
                },
            ],
        ],
    }

}
generateDatePaymt(info) {
  return {
    margin: [0, 10],
    columns: [
      [
        { text: `Mes: ${info.month}`},
        { text: `Fecha: ${info.currentDate}` }
      ],
      [
        { text: 'Comprobante de Pago' },
        { text: `${info.paymentId}` }
      ],
    ]
  }
}
generateLinePaymnt() {
  return {
    table: {
      widths: ['*'],
      body: [[' '], [' ']]
    },
    layout: {
      hLineWidth: (i, node) => {
        return (i === 0 || i === node.table.body.length) ? 0 : 1
      },
      hLineColor: function(i, node) {
        return (i === 0 || i === node.table.body.length) ? 'black' : '#D8D8D8';
      },
      vLineWidth: (i, node) => {
        return 0
      },
    }
  }
}
generatePaymentPropertyData(realState) {
  return {
    margin: [0, 10],
    width: '*',
    layout: 'noBorders',
    table: {
      headerRows: 0,
      widths: [80 , '*', 80, 100 ],
      body: [
        [ 'Nombre:', realState.name, 'Código:', realState.code ],
        [ 'Inmueble:', realState.address, 'Coeficiente:', realState.ratio ],
      ]
    }
  }
}
generatePaymentList(payments) {
    
  const rows = Array.isArray(payments) ? payments.map(payment => {
    return [payment.realState, payment.type, payment.previous, payment.debt, payment.total]
  }) : []
  return {
    margin: [0, 10, 0, 0],
    layout: 'noBorders',
    table: {
      headerRows: 1,
      widths: ['*', '*', '*', '*', '*'],
      body: [
        [
          'Inmueble',
          { text: 'MÉTODO', bold: true },
          { text: 'SALDO ANTERIOR', bold: true },
          { text: 'MONTO PAGO', bold: true },
          { text: 'MONTO RESTANTE', bold: true },
        ],
       ...rows
      ],
    },
  }
}
generateNote(info) {
  return {
    columns: [
      { text: 'Notas:', bold: true, width: 70 },
      { text: info.note }
    ]
  }
}

  generateSealRect() {
    return {
      canvas: [
        {
          type: 'rect',
          x: 20, y: 0,
          w: 115,
          h: 70,
          lineWidth: 4,
          lineColor: '#FF6E6E',
          r: 5
        },
      ],
      absolutePosition: {x: 400, y: 300}
    }
  }

  generateSealPayment() {
    return {
      text: 'PAGADO',
      fontSize: 25,
      bold: true,
      color: '#FF6E6E',
      absolutePosition: {x: 430, y: 310}
    }
  }
  generateSealDate(info) {
    return {
      text: `Fecha: ${info.paymentDate}`,
      fontSize: 11,
      bold: true,
      color: '#FF6E6E',
      absolutePosition: {x: 430, y: 340}
    }
  }*/

  /*****************************************************************/
  /** FIN CODIGO DISEÑO PARA COMPROBANTE DE PAGO POR CORREO (PDF)  */
  /*****************************************************************/
  

  /*****************************************************************/
  /** CODIGO PARA CONVERTIR PDF A BUFFER PARA EL ENVIO POR CORREO  */
  /*****************************************************************/

  #pdfFileName = () => crypto.randomBytes(4).toString('hex') + '.pdf'

  #absPath = (filename) => path.join(process.cwd(), tempPath, filename)

  createLoadPdfWithBuffer = async (buffer, res, pay=false) => {
    const fileName = this.#pdfFileName()
    const absPath = this.#absPath(fileName)
    if (pay){
    return this.#createTemporalPDFPayment(buffer, absPath, res)
    }else{
     return this.#createTemporalPDF(buffer, absPath, res)
    
    } 
  }

  #createTemporalPDF = (buffer, filename, res) => {

    let error = null

    fs.writeFile(filename, buffer, function (err) {

      if (err) {
        error = err
        return
      }

      res.download(filename, 'factura_wihom.pdf', () => {
        fs.unlink(filename, function (err) {
          if (err) {
            console.log(err)
          }
        })
      })

    });

    return error

  }
  #createTemporalPDFPayment = (buffer, filename, res) => {

    let error = null

    fs.writeFile(filename, buffer, function (err) {

      if (err) {
        error = err
        return
      }

      res.download(filename, 'pago_wihom.pdf', () => {
        fs.unlink(filename, function (err) {
          if (err) {
            console.log(err)
          }
        })
      })

    });

    return error

  }

}
