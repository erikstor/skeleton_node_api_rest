import { BaseService } from './base.service.js'

export class SendNotifications extends BaseService {
  constructor(body) {
    super(body);
    this.body = body;
    this.STATUS_SENT = 5
    this.STATUS_UNDELIVERY = 7
    this.INVOICE_ADMIN = 20
  }

  getInvoiceId =  (id , services) => {
    try {

    const sequenceService = new services.SequenceService()
    if(!Number.isInteger(id)) {
      return sequenceService.removeIdTail(id)
    }
    return id
    } catch (e) {
      console.log('getInvoiceId----->', e)
      return id
    }

  }
  convertCardsLogos = async () =>{
      let visa = await this.convertImagesLogos(this.util.visa_image)
      let mastercard = await this.convertImagesLogos(this.util.mastercard_image)
      let pse = await this.convertImagesLogos(this.util.pse_image)
      let wihomLogo = await this.convertImagesLogos(this.util.logo_wihom_footer)
      let wihomPay = await this.convertImagesLogos(this.util.wihomPay) 
    return {
        visa, mastercard, pse, wihomLogo, wihomPay
    }
  }

  sendNotificationMessage = async ( realState, projectData, token, whatsapp, services) => {
    
    //const copyRs = [...realState];
    const encryptService = new services.EncryptService();
    const pdfService = new services.PdfService();
    const realStateService = new services.RealStateService()

    const urlDomain = this.util.getFrontURL();

    let cards = await this.convertCardsLogos()

    for (let i = 0; i < realState.length; i++) {
      let rs = realState[i];
      try {
        // encriptado del invoce.id para enviar link de pago
        const invoiceId = this.getInvoiceId(rs.invoice.id, services)
        const encryptData = await encryptService.encryptEAS(rs.invoice.id);
        rs.creditBalance = rs.creditBalance??0
        // calcula valores de los conceptos y total a enviar en el template y PDF
        const conceptsAndValues = await this.calculateValues(rs);
        // organiza los conceptos para enviar valor y nombre
        let dataConcept = rs.concepts.filter(concept =>
          (Math.round(parseFloat(concept.price) / parseFloat(concept.round)) !== 0 ||
           (concept.previousBalance && Math.round(parseFloat(concept.previousBalance) / parseFloat(concept.round)) !== 0))
        ).map((concept) => {
          let price = Math.round(parseFloat(concept.price) / parseFloat(concept.round)) *
          parseFloat(concept.round);
        let previousBalance =
          Math.round(
            parseFloat(concept.previousBalance) / parseFloat(concept.round)
          ) * parseFloat(concept.round);
          return {
            name: concept.name,
            debt: previousBalance ? `$ ${previousBalance}` : '$ 0',
            price: `$ ${price}`,
            total: previousBalance ? `$ ${this.number(price).add(previousBalance).value()}` : `$ ${price}`,
          };
        });
        if (rs.creditBalance && rs.creditBalance>10){
          dataConcept.push({
            name: "Saldo a favor",
            debt: "",
            price:`- $ ${conceptsAndValues.creditBalance}`,
            total: `- $ ${conceptsAndValues.creditBalance}`
          })
        }

        // objeto para generar el template del correos
        let dataEmail = await this.orderDataEmail (rs, projectData, invoiceId, conceptsAndValues,dataConcept, urlDomain, encryptData)
        // Se convierte la imagen desde la URL guardada en el proyecto a base64
        const imageConvert = await this.convertURLtoBufferImage(
          projectData.url_logo
        );

       // objeto para generar el PDF del correo

        let dataPDF = await this.orderDataPdf(rs, projectData,invoiceId, conceptsAndValues, dataConcept, urlDomain, encryptData,imageConvert, cards )
        // se genera el archivo pdf
        const pdfFile = await pdfService.invoice(dataPDF, !!rs.invoicePaid);
        // se envia el correo con PDF

        rs.contactData = await realStateService.getUserPhoneEmailByRealState(rs.id)

        // cycle for send notifications for all people relationated with the real state
        for (const c of rs.contactData) {

          await services.sendEmailService.scheduledEmail(
            c.email, 'notificationInvoice', dataEmail, pdfFile, services
          );

          const phone = c.phone_number.split('__wihom_debugging__')

          if (whatsapp) {
            let dataWhatapp = {
              id: invoiceId,
              projectName: projectData.business_name,
              price: conceptsAndValues.total,
              // TODO validar que hacer cuando no se tenga fecha de descuento, si el mensaje cambia
              date: //conceptsAndValues.discountSum[0]? conceptsAndValues.discountSum[0].date:
                this.moment().endOf('month').format('DD/MM/YYYY'),
              phone_number: phone[0],
              payment_link: `${urlDomain}/#/payments/checkout/${encryptData}`
            };
            //  console.log("here ----->", dataWhatapp)
            await this.axios
              .post(urlDomain + '/twilio/billing', dataWhatapp, {
                headers: {Authorization: token},
              })
              .catch(function (error) {
                if (error.response) {

                  // Request made and server responded
                  console.log('response error ------------>', error.response.data);
                  //console.log(error.response.status);
                  //console.log(error.response.headers);
                } else if (error.request) {
                  // The request was made but no response was received
                  console.log('request error ------------->', error.request);
                } else {
                  // Something happened in setting up the request that triggered an Error
                  console.log(' else error --------->', error.message);
                }
              });
          }
        }

      } catch (error) {
        if (rs.invoice.id){
        const invoiceService = new services.InvoiceService()
        await invoiceService.updateStatus(rs.invoice.id, invoiceService.STATUS_UNDELIVERY)
        }
        // Something happened in setting up the request that triggered an Error
        console.log(error)
          console.log(`Error: ${error.message} -> invoice: ${rs.invoice.id}` );

      }
    }
    // TODO definir que hacer con los errores
    return {message:"ok"};
  };

  // function used to identify if the image ends with image extension
  endsWithAny(suffixes, string) {
    return suffixes.some(function (suffix) {
      return string.endsWith(suffix);
    });
  }

  // Using axios will download image as arraybuffer.
  // And after that will pass that data for base64 encoding process.
convertImagesLogos = async (urlImage) =>{
  let image = '';
  try {
    image = await this.axios.get(urlImage, { responseType: 'arraybuffer' });
  } catch (error) {
    return
  }
  let raw = Buffer.from(image.data).toString('base64');
  return 'data:' + image.headers['content-type'] + ';base64,' + raw;
}

  convertURLtoBufferImage = async (urlImage) => {

    let defaultLogo = this.util.default_wihom_logo

    const listFormats = ['.png', '.PNG', '.jpg', '.JPG', '.jpeg', '.JPEG'];
    let image = '';
    try {
      if (!this.endsWithAny(listFormats, urlImage)) {
        throw new this.errors.CustomError(
          'El archivo no es una imagen valida',
          400
        );
      }
      image = await this.axios.get(urlImage, { responseType: 'arraybuffer' });
    } catch (error) {
      image = await this.axios.get(defaultLogo, {
        responseType: 'arraybuffer',
      });
    }
    let raw = Buffer.from(image.data).toString('base64');
    return 'data:' + image.headers['content-type'] + ';base64,' + raw;
  };

  arrayMove(arr, fromIndex, toIndex) {
    //console.log("here the arr", arr)
    var element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
  }

  calculateValues = async (data) => {
    /*            
      "creditBalance": "32000",
      "invoicePaid":false, 
      concepts : {
        "id": "55d2e1c0-f6fb-11eb-aa80-7bfdc338740c",
        "price": "27320",
        "name": "Cuota de administración",
        "description": "Concepto fijo creado por el sistema",
        "round": "100",
        "project": "320c8cf4-784a-4466-9330-3de8c33e32c3",
        "type": 20,
        "BillingInterest": {
            "id": "560cb670-f6fb-11eb-aa80-7bfdc338740c",
            "amount": "1.7",
            "greater_than": "32000",
            "concept": "55d2e1c0-f6fb-11eb-aa80-7bfdc338740c",
            "type": 17
        },
        "BillingDiscounts": [
            {
                "id": "56468b20-f6fb-11eb-aa80-7bfdc338740c",
                "amount": null,
                "percentage": "2",
                "deadline": "2021-08-21T05:00:00.000Z",
                "concept": "55d2e1c0-f6fb-11eb-aa80-7bfdc338740c"
            }
        ],
        "previousBalance": "37500"
    } */
    this.moment.locale('es');
    let total = 0;
    let discountSum = [];
    /* SE ORDENA PARA APLICAR LOS DESCUENTOS DE ADMINISTRACION DESPUES DE SUMAR LOS CONCEPTOS ANTERIORES */
    let indxAdminConc = data.concepts.findIndex(conc => conc.type === this.INVOICE_ADMIN)
    
    if (indxAdminConc === -1){
      throw new this.errors.CustomError("No existe el concepto de administracion")
    }
    this.arrayMove(data.concepts, indxAdminConc, data.concepts.length)
    /* ------------------------------------------------------------------- */
    if (data.creditBalance){
     data.creditBalance =  await this.formulaRoundCostConcept(data.creditBalance, data.concepts[indxAdminConc].round??10)
    }
    for (let concept of data.concepts) {
      // valor del concepto aplicando el redondeo
      let price = await this.formulaRoundCostConcept(concept.price, concept.round)

      // se redondea el balance previo para evitar sumar centavos
      let previousBalance = await this.formulaRoundCostConcept(concept.previousBalance, concept.round)

      if (price === 0 && (!concept.previousBalance || previousBalance === 0)){
        continue
      }
      if (concept.previousBalance && previousBalance !== 0 ) {
        total = this.number(total).add(concept.previousBalance).value();
        }
        
        
      if (concept.BillingDiscounts?.length > 0) {
        //  si el concepto tiene mas de 1 descuentos se recorrer los descuentos
        for (let i = 0; i < concept.BillingDiscounts.length; i++) {
          let tempDiscount = {};
          let valueConcepts = concept.BillingDiscounts[i];
          let roundValue = 0
          // objeto temporal a devolver al pdf y correo

          // tempDiscount es el objeto que se devuelve en cada descuento
          // fechas usadas en cada descuento
          tempDiscount.days = this.moment(concept.BillingDiscounts[i].deadline).format('DD')
          tempDiscount.date = this.moment(concept.BillingDiscounts[i].deadline).format('DD/MM/YYYY');
          tempDiscount.month = this.moment(concept.BillingDiscounts[i].deadline).format('MMMM');
          
          // aqui se agrega el respectivo descuento al array de descuentos (ya que pueden ser varios)
          
          if (concept.BillingDiscounts[i].amount !== null) {
            tempDiscount.percentage = `$ ${concept.BillingDiscounts[i].amount}`;

            // valueWithDiscount  se hace el calculo de el valor total + cuota administracion - saldo descuento administracion
            roundValue = price > parseFloat(valueConcepts.amount) ?
             this.number(price).subtract(valueConcepts.amount).value() : this.number(0).add(total).value()
            // se aplica el valor del saldo a favor a el total - el descuento
            roundValue = this.number(roundValue).subtract(data.creditBalance) >0?
            this.number(total).add(this.number(roundValue).subtract(data.creditBalance)).value(): 0
            tempDiscount.valueWithDiscount = `$ ${await this.formulaRoundCostConcept(roundValue, concept.round)}` ;
            
          } else if (concept.BillingDiscounts[i].percentage !== null) {
            tempDiscount.percentage = `${concept.BillingDiscounts[i].percentage} %`;
            
            // valueWithDiscount  se hace el calculo de el valor total + cuota administracion - % saldo descuento administracion
            roundValue = concept.BillingDiscounts[i].percentage <= 100 ?
                         this.number(total).add(this.number(price).subtract(this.number(price).multiply(valueConcepts.percentage)
                         .divide(100).value())).value(): this.number(0).add(total).value()
            // se aplica el valor del saldo a favor a el total - el descuento
            roundValue = this.number(roundValue).subtract(data.creditBalance) > 0?
                         this.number(roundValue).subtract(data.creditBalance).value(): 0
            tempDiscount.valueWithDiscount = `$ ${await this.formulaRoundCostConcept(roundValue, concept.round)}` ;
          } 
          
          // se genera el objeto necesario para enviar los descuentos en el pdf y el correo
          discountSum.push(tempDiscount);
        }
        //console.log("here the sum ", discountSum)
      }
      total = this.number(total).add(price).value();
    }
    if (this.number(total).subtract(data.creditBalance).value() < 0 || data.invoicePaid){
      total = 0
      discountSum = []
    } else {
      total = this.number(total).subtract(data.creditBalance).value()
    }
    return { total/* total es el total sin descuento */, discountSum /* array con obj descuentos */, creditBalance:data.creditBalance};
  };
  orderDataEmail = async (rs, projectData, invoiceId, conceptsAndValues, dataConcept, urlDomain, encryptData) =>{
    return {
          id: invoiceId,
          projectName: projectData.business_name,
          email: rs.email,
          //phone_number: projectData.phone_number,
          logoImage: projectData.url_logo,
          dataConcept,
          total: `$ ${conceptsAndValues.total}`,
          discounts: conceptsAndValues.discountSum,// only fist discount
          payment_link: `${urlDomain}/#/payments/checkout/${encryptData}`,
          /*-- nuevos campos---*/
          userName: rs.name,
          projectNumber:projectData.phone_number,
          projectProperty: /*`${projectData.division} ${rs.division_value} - ${rs.residential_units}`*/
                            `${rs.division_value} - ${rs.residential_units}`,
          /*--campos nuevo modelo---*/
          invoiceDate: this.moment(rs.invoice.date).format('DD/MM/YYYY'),
          invoiceMonth: this.moment(rs.invoice.date).format('MMMM'),
          creditBalance: !!parseFloat(rs.creditBalance),
          // Aqui link de descarga de pdf enviado en el correo
          download_link: `${urlDomain}/#/payments/downloadPdfInvoice/${encryptData}`
        };
  }

  orderDataPdf = async(rs, projectData,invoiceId, conceptsAndValues, dataConcept, urlDomain, encryptData,imageConvert, cards )=>{
    return {
          date: {
            month: this.moment(rs.invoice.date).format('MMMM'),
            currentDate: this.moment(rs.invoice.date).format('DD/MM/YYYY'),
          },
          project: {
            logo: imageConvert,
            address: projectData.address,
            nit: projectData.nit,
            name: projectData.business_name,
            //add new template pdf
            phone_number: projectData.phone_number
          },
          real_state: {
            name: rs.name,
            code: `${rs.division_value}${rs.residential_units}`,
            ratio: rs.ratio,
            address: `${rs.division_value} - ${rs.residential_units}`,
          },
          total: conceptsAndValues.total,
          concepts: dataConcept,
          discounts: conceptsAndValues.discountSum /* [
                    {
                        days: "3",
                        date: "03/08/2021",
                        percentage: 3,
                        valueWithDiscount: "$5,987.65",
                        month: "agosto"
                    }
                ] */,
          comment: 'Sin mensaje asignado',
          payment_link: `${urlDomain}/#/payments/checkout/${encryptData}`,
          cedit_balance_applied: false, // cuando se paga total
          images: {
            visa:  cards.visa?cards.visa:imageConvert,
            mastercard: cards.mastercard?cards.mastercard:imageConvert,
            pse: cards.pse?cards.pse:imageConvert,
            // add
            //wihomPay, wihomLogo
            wihomLogo: cards.wihomLogo,
            wihomPay: cards.wihomPay,
          },
          code : invoiceId
        };
}





  sendFullCancelled = async (email, data, realState, projectData, services) => {

    const pdfService = new services.PdfService();

    try {
       for (let i = 0; i < realState.length; i++) {
         let rs = realState[i];
         // calcula valores de los conceptos y total a enviar en el template y PDF
         const conceptsAndValues = await this.calculateValues(rs);

         // organiza los conceptos para enviar valor y nombre
         let dataConcept = rs.concepts.map((concept) => {
           let price = Math.round(parseFloat(concept.price) / parseFloat(concept.round)) *
             parseFloat(concept.round);
           let previousBalance =
             Math.round(
               parseFloat(concept.previousBalance) / parseFloat(concept.round)
             ) * parseFloat(concept.round);
           return {
             name: concept.name,
             debt: previousBalance ? `$ ${previousBalance}` : '$ 0',
             price: `$ ${price}`,
             total: previousBalance ? `$ ${this.number(price).add(previousBalance).value()}` : `$ ${price}`,
           };
         });

         // Se convierte la imagen desde la URL guardada en el proyecto a base64
         const imageConvert = await this.convertURLtoBufferImage(
           projectData.url_logo
         );
         // objeto para generar el PDF del correo
         let dataPDF = {
           date: {
             month: this.moment().format('MMMM'),
             currentDate: this.moment().format('DD/MM/YYYY'),
           },
           project: {
             logo: imageConvert,
             address: projectData.address,
             nit: projectData.nit,
             name: projectData.business_name,
           },
           real_state: {
             name: rs.name,
             code: `${rs.division_value}${rs.residential_units}`,
             ratio: rs.ratio,
             address: `${rs.division_value}${rs.residential_units}`,
           },
           total: conceptsAndValues.total,
           concepts: dataConcept,
           discounts: conceptsAndValues.discountSum, // verificar si los descuentos vienen en orden, sino ordenar desde entrada(consulta)
           comment: 'Sin mensaje asignado'

         };
         // se genera el archivo pdf
         const pdfFile = await pdfService.invoiceWatermark(dataPDF, true);

         // se envia el correo con PDF
         await services.sendEmailService.scheduledEmail(email, 'notificationPayments', data, pdfFile, services, true);
       }
    } catch (error) {
      console.log('Ocurrió un error con el envió de una factura cancelada completamente')
      console.log(error)
    }
  };

  manuallyPaymentNotific = async (paymentData, services, throwError = true) => {

    //const pdfService = new services.PdfService();
    const payment2Service = new services.Payment2Service()
    const encrypt = new services.EncryptService()
    const urlDomain = this.util.getFrontURL();
    try {
      const pdfFile = await payment2Service.downloadPdfPayment(paymentData.id, services)
      const encryptInvoice = await encrypt.encryptEAS(pdfFile.invoice);
      const encryptPayment = await encrypt.encryptEAS(paymentData.id);
        //const pdfFile = await this.generatePaymentPDF(paymentData, checkoutInitialData, pdfService)
        let dataEmail = {
          url_logo: paymentData.url_logo,
          name: paymentData.name,
          projectName: paymentData.business_name,
          paymentId: paymentData.id,
          payMethod: paymentData.pay_method,
          paymentAmount: paymentData.amount,
          dateline: this.moment(paymentData.createdAt).format('DD/MM/YYYY'),
          note: paymentData.gateway_info?paymentData.gateway_info.note:"(Sin notas)",
          // project info
          property: `${paymentData.division_value} - ${paymentData.residential_units}`,
          invoice: pdfFile.invoiceId,
          projectAddress: paymentData.address,
          phone_number: paymentData.phone_number,
          projectEmail: paymentData.in_charge,
          // link descarga pago y checkout
          download_link: `${urlDomain}/#/payments/downloadPdfPayment/${encryptPayment}`,
          // link checkout cambiar encryptInvoice TODO
          payment_link: `${urlDomain}/#/payments/checkout/${encryptInvoice}`

        }

        // se envia el correo con PDF
        if (pdfFile){
        await services.sendEmailService.scheduledEmailPayment(paymentData.email, 'notificationManuallyPayment', dataEmail, pdfFile.pdf, true);
        }

       } catch (error) {
        console.log('manuallyPaymentNotific Error:', error)
        if (throwError) {
          throw new this.errors.CustomError('Ocurrió un error con el envió del recibo')

        }
    }
  };
// se reemplazó por (downloadPdfPayment) payment2.service.js 2022-feb-11
/**   generatePaymentPDF = async (paymentData, checkoutData, pdfService) => {
    // TODO EN ESTE PUNTO SE DEBE RECIBIR EL PREVIO Y EL ACTUAL
    try {
      let totalPreviousB = 0
      // console.log(checkoutData)

      for (const current of checkoutData.breakdownPreviousBalance || []) {
        totalPreviousB += await this.formulaRoundCostConcept(current.debt, current.round)
      }

      for (const current of (checkoutData.currentConcepts || [])) {
        totalPreviousB += await this.formulaRoundCostConcept(current.debt, current.round)
      }
          console.log(totalPreviousB)
      // Se convierte la imagen desde la URL guardada en el proyecto a base64
      const imageConvert = await this.convertURLtoBufferImage(
        paymentData.url_logo
      );
      // TODO preguntar las fechas (currentDate fecha de creacion del pago o actual? puede variar)

      // objeto para generar el PDF del correo
      this.moment.locale('es');
      let dataPDF = {
        info: {
          month: this.moment().format('MMMM'),
          currentDate: this.moment().format('DD/MM/YYYY'),
          paymentDate: this.moment(paymentData.createdAt).format('DD/MM/YYYY') ,
          paymentId: paymentData.id,
          note: paymentData.gateway_info ? paymentData.gateway_info.note : '(Sin notas)'
        },
        payments: [{// monto restante
          realState: `${paymentData.division} ${paymentData.division_value} ${paymentData.residential_units}`,
          type: paymentData.pay_method,
          previous: `$ ${paymentData.beforeApplyPayment}`//balance previo ,
          debt: `$ ${paymentData.amount}`// monto pago mes ,
          total: ((paymentData.beforeApplyPayment - paymentData.amount) > 0) ? `$ ${paymentData.beforeApplyPayment - paymentData.amount}` : `$ ${0}`// total total previous + debt 
        }
        ],
        project: {
          logo: imageConvert,
          address: paymentData.address,
          nit: paymentData.nit,
          name: paymentData.business_name,
        },
        real_state: {
          name: paymentData.name,
          code: `${paymentData.division_value}${paymentData.residential_units}`,
          ratio: paymentData.ratio,
          address: `${paymentData.residential_units} - ${paymentData.division_value}`,
        }
      };

      // se genera el archivo pdf
      return await pdfService.generatePaymentPdf(dataPDF, true);
    } catch (err) {
      console.log('Error:', err)
      throw this.errors.CustomError('Ocurrió un error al generar  el PDF')
    }

  } */








}


