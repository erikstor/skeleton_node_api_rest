import axios from 'axios'
import {getFrontURL} from '../utils/front-url.util.js'
import { BaseService } from './base.service.js'
import { EncryptService } from './encrypt.service.js';
import {sendEmailService} from './send-email.service.js'

export class SendWhatsappService extends BaseService {
  //const urlDomain = getFrontURL() + '/billing-api'
  constructor(body) {
    super(body);
    this.body = body;
  }


  sendWhatssappMessage = async ( realState, token) => {    
    try {

      //   const response = await axios.post(
      //     'http://localhost:3500/twilio/billing',
      //     billing,
      //     { headers: { Authorization: token } }
      //   );
      //   console.log('here the response axioss--->', response.data);
      return true  
      } catch (err) {
      return false
      }
  }
}
