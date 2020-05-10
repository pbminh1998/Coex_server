import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
  Entity,
  property,
  model,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getFilterSchemaFor,
  getModelSchemaRef,
  getWhereSchemaFor,
  patch,
  put,
  del,
  Request,
  RestBindings,
  requestBody,
  HttpErrors,
} from '@loopback/rest';
import { TransactionRepository } from "../repositories";
import { authorize } from '@loopback/authorization';
import { authenticate, TokenService } from '@loopback/authentication';
import { TokenServiceBindings } from '../services/key';
import { UserRepository } from '../repositories';
import { SecurityBindings, securityId, UserProfile } from '@loopback/security';
import { basicAuthorization } from "../services/basic.authorizor";
import { AppResponse } from '../services/appresponse';
import { inject } from '@loopback/context';
import { cDate } from '../services/date';
import { MyDefault } from '../services/mydefault';

const Axios = require('axios').default; // npm install axios
const CryptoJS = require('crypto-js'); // npm install crypto-js
const moment = require('moment'); // npm install moment

const config = {
  appid: "553",
  key1: "9phuAOYhan4urywHTh0ndEXiV3pKHr5Q",
  key2: "Iyz2habzyr7AG8SgvoBCbKwKi3UzlLi3",
  endpoint: "https://sandbox.zalopay.com.vn/v001/tpe/createorder",
  checkReult: "https://sandbox.zalopay.com.vn/v001/tpe/getstatusbyapptransid"
};


export class PaymentController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @inject(RestBindings.Http.REQUEST) private request: Request,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService
  ){

  }

  @post('/payment/create_payment_url', {
    responses: {
      '200': {
        description: 'Get price of booking',
      },
    },
  })
  async createPayment(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['point'],
            properties: {
              transaction_id: { type: 'string' },
            },
          },
        },
      },
    }) request: { transaction_id: string }
  ): Promise<AppResponse> {
    const transaction = await this.transactionRepository.findById(request.transaction_id);

    // if(await this.getBookingTransStatus(transaction))
    if(transaction.payment)
      throw new AppResponse(400,"This booking already payment");

      if(transaction.status == MyDefault.TRANSACTION_STATUS.CANCELLED || transaction.status == MyDefault.TRANSACTION_STATUS.SUCCESS)
      throw new AppResponse(400,"This booking cannot payment");

    const embeddata = {
      redirecturl: "https://coexspace.herokuapp.com/payment/result",
      transaction_id: transaction.id
    };

    const items: any = [];

    const order: any = {
      appid: config.appid,
      apptransid: `${moment().format('YYMMDD')}_${transaction.booking_reference}`, // mã giao dich có định dạng yyMMdd_xxxx
      appuser: "end-user",
      apptime: Date.now(), // miliseconds
      item: JSON.stringify(items),
      embeddata: JSON.stringify(embeddata),
      amount: transaction.price,
      description: `Payment for booking ${transaction.booking_reference}`,
      // bankcode: "zalopayapp",
    };

    // appid|apptransid|appuser|amount|apptime|embeddata|item
    const data = config.appid + "|" + order.apptransid + "|" + order.appuser + "|" + order.amount + "|" + order.apptime + "|" + order.embeddata + "|" + order.item;
    order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();


    const res = await Axios.post(config.endpoint, null, { params: order });
    return new AppResponse(200,"abc",res.data);
  }

  @authenticate('jwt')
  @authorize({
    allowedRoles: ['Customer'],
    voters: [basicAuthorization],
  })
  @post('/payment/checkResult', {
    responses: {
      '200': {
        description: 'Get price of booking',
      },
    },
  })
  async checkReult(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['transaction_id'],
            properties: {
              transaction_id: { type: 'string' },
            },
          },
        },
      },
    }) request: { transaction_id: string }
  ): Promise<AppResponse> {
    const transaction = await this.transactionRepository.findById(request.transaction_id);

    if(transaction.payment)
      return new AppResponse(200,"This booking already payment", {code: true,key: "PAYMENT_DONE"});
    else
      return new AppResponse(200,"This booking need payment",{code: false,key: "NEED_PAYMENT"});
  }

  @post('payment/result', {
    responses: {
      '200': {
        description: 'Callback',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                returncode: {type: 'int'},
                returnmessage: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async result(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['point'],
            properties: {
              data: { type: 'string' },
              mac: {type: 'string'}
            },
          },
        },
      },
    }) callback_data: { data: string, mac: string }
  ): Promise<{}> {
    let response = {returnCode: 0,returnmessage: ""};
    try{
      const reqmac = CryptoJS.HmacSHA256(callback_data.data, config.key2).toString();
      if (reqmac == callback_data.mac) {
        const data = JSON.parse(callback_data.data, config.key2 as any);
        await this.transactionRepository.updateById(data.embeddata.transaction_id,{payment: true});
        response.returnCode = 1;
        response.returnmessage = "success";
      } else {
        response.returnCode = -1;
        response.returnmessage = "mac not equal";
      }
    }catch(e){
      response.returnmessage = e.message;
    }
    return response;
  }

  // async getBookingTransStatus(transaction :any){
    // if(transaction.payment) return true;
    // const params: any = {
    //   appid: config.appid,
    //   apptransid: `${moment().format('YYMMDD')}_${transaction.booking_reference}`,
    // };

    // // appid|apptransid|appuser|amount|apptime|embeddata|item
    // const data = config.appid+"|"+params.apptransid+"|"+config.key1;
    // params.mac = CryptoJS.HmacSHA256(data, config.key1).toString();
    // console.log(params);
    // const res = await Axios.get(config.checkReult, { params });
    // const response = res.data;
    // console.log(response);
    // if(response && response.returncode == 1){
    //   transaction.payment = true;
    //   this.transactionRepository.update(transaction);
    //   return true;
    // }
    // return false;
  // }
}
