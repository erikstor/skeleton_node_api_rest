
import { BaseService } from './base.service.js';
import { promises } from 'fs';
import handlebars from 'handlebars';
import nodemailer from 'nodemailer';
import path from 'path'
import AWS from 'aws-sdk';

const credentials = {
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
};

const awsConfig = new AWS.Config();
awsConfig.credentials = credentials;
awsConfig.region = process.env.AWS_ACCESS_REGION;

const sesv2 = new AWS.SESV2(awsConfig);

class SendEmailService extends BaseService {

  constructor(body, params, query) {
    super(body, params, query)
  }



  templatesFolder = process.cwd() + '/src/templates/';
  sender = sesv2;

  _emailTemplates = {
    // test: `${this.templatesFolder}test.html`,
    notificationInvoice: `${this.templatesFolder}new_templates/notificacion_facturas_nuevo.html`,
    notificationPayments: `${this.templatesFolder}notificacion_estado_transacción.html`,
    
    notificationAprovedPayments: `${this.templatesFolder}new_templates/notificacion_pago_aprobado_nuevo.html`,
    notificationRejectedPayments: `${this.templatesFolder}new_templates/notificacion_pago_rechazado_nuevo.html`,
    notificationManuallyPayment: `${this.templatesFolder}new_templates/notificacion_pagos_manuales_nuevo.html`
  };

  // Default subject for each kind of notification
  _emailSubjects = {
    // test: info => `${info.name || ''} ha recibido tu solicitud`,
    // eslint-disable-next-line no-unused-vars
    notificationInvoice: (info) => `${info.projectName?info.projectName:info} ha generado tu factura de administración`,
    notificationPayments: (info) => `Transacción ${info.estado_transaccion} en ${info.projectName}`,

    notificationAprovedPayments: (info) => `Transacción ${info.estado_transaccion} en ${info.projectName}`,
    notificationRejectedPayments: (info) => `Transacción ${info.estado_transaccion} en ${info.projectName}`,
    notificationManuallyPayment: (info) => `${info.projectName} ha generado tu comprobante de pago`
    //notificationRejectedPay: (info) => 'Factura rechazada'
  }

  _renderTemplate(template, data) {
    handlebars.registerHelper('ifeq', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
  });
    const render = handlebars.compile(template);
    const html = render(data);
    return html;
  }

  _createEmailParams(mails, subject, html) {
    // Create sendEmail params
    const emailParams = {
      Content: {
        Simple: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: html,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
      },
      Destination: { ToAddresses: [mails] },
      FromEmailAddress: 'Notificaciones WiHom <notificaciones@wihom.com.co>',
    };

    return emailParams;
  }

  async _sendSESMailWrapper(emailType, emailParams) {
    try {
      const data = await this.sender.sendEmail(emailParams).promise();
      console.log(
        `${emailType} Email sent to ${emailParams.Destination.ToAddresses}`
      );
      // console.info(data);
    } catch (error) {
      console.error(error);
    }
  }

  async processEmail(mails, templateName, emailData) {
    // console.log(this._emailTemplates)
    const template = this._emailTemplates[templateName];
    const subject = this._emailSubjects[templateName](emailData);

    // console.log(template)
    try {
      const templateData = await promises.readFile(template, 'utf8');
      const html = this._renderTemplate(templateData, emailData);
      const emailParams = this._createEmailParams(mails, subject, html);
      await this._sendSESMailWrapper(templateName, emailParams);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * @deprecated
   */
  sendEmailWithAttached = async (
    mails,
    emailType,
    emailData,
    subjectVar,
    fileArray
  ) => {
    const template = this._emailTemplates[emailType];
    const subject = this._emailSubjects[emailType](subjectVar || emailData);

    try {
      const templateData = await promises.readFile(template, 'utf8');
      const html = this._renderTemplate(templateData, emailData);
      const emailParams = this._createEmailParams(mails, subject, html);
      this._sendSESMailWrapper(emailType, emailParams);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   *  TODO: AÑADIR LOS PARAMETROS CORRECTOS PARA ENVIAR EL CORREO EN PRODUCCIÓN
   *  Cambiar el path del archivo que se esta enviando en el correo
   */

  scheduledEmail = async (emails, emailType, emailData, pdfFile, services, forGateway = false) => {

    const template = this._emailTemplates[emailType];
    const subject = forGateway === false ? this._emailSubjects[emailType]( emailData.projectName ) : this._emailSubjects[emailType]( emailData )
   
    const ses = new AWS.SES({
      apiVersion: '2010-12-01',
      region: 'us-east-1',
    });

    let transporter = nodemailer.createTransport({
      SES: ses,
      AWS,
    });

     let text = 'Attached is a CSV of some stuff.';
    const templateData = await promises.readFile(template, 'utf8');
    const html = this._renderTemplate(templateData, emailData);
    
    // send mail with defined transport object
    let responseEmail
    const absPath = this.#absPath('notificacion-facturas.html')

    await transporter.sendMail(
      {
        from: 'Notificaciones WiHom <notificaciones@wihom.com.co>',
        to: emails,
        subject: subject, // Subject line
        text: text, // plaintext version
        html: html, // html version
        attachments: [
          {
            filename: 'factura.pdf',
            content: pdfFile,
            contentType:"application/pdf"
          },
        ],
      },

      async (err, info) => {
        const invoiceService = new services.InvoiceService()
        if (err) {
          if (!Object.prototype.hasOwnProperty.call(emailData, 'retry')) {
            emailData.retry = true;
            this.scheduledEmail(emails, emailType, emailData, pdfFile, services)
          }
          else {
            await invoiceService.updateStatus(emailData.id, invoiceService.STATUS_UNDELIVERY)
          }
        }

        if (info) {
          responseEmail = info
          await invoiceService.updateStatus(emailData.id, invoiceService.STATUS_SENT)
        }

      }
    );

    return responseEmail; // or something
  };

  scheduledEmailPayment = async (email, emailType, emailData, pdfFile, forGateway = false) => {

    const template = this._emailTemplates[emailType];
    const subject = forGateway === false ? this._emailSubjects[emailType]( emailData.projectName ) : this._emailSubjects[emailType]( emailData )
   
    const ses = new AWS.SES({
      apiVersion: '2010-12-01',
      region: 'us-east-1',
    });

    let transporter = nodemailer.createTransport({
      SES: ses,
      AWS,
    });

     let text = 'Attached is a CSV of some stuff.';
    const templateData = await promises.readFile(template, 'utf8');
    const html = this._renderTemplate(templateData, emailData);
    
    // send mail with defined transport object
    await transporter.sendMail(
      {
        from: 'Notificaciones WiHom <notificaciones@wihom.com.co>',
        to: email,
        subject: subject, // Subject line
        text: text, // plaintext version
        html: html, // html version
        attachments: [
          {
            filename: 'Recibo.pdf',
            content: pdfFile,
            contentType:"application/pdf"
          },
        ],
      },
    );

  };

  #absPath = (filename) => path.join(process.cwd(), '/src/templates', filename)

}

export const sendEmailService = new SendEmailService();
