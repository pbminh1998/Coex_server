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
import { MyDefault } from '../services/mydefault';


export class VnpayController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService
  ){

  }

  @authenticate('jwt')
  @authorize({
    allowedRoles: ['Customer'],
    voters: [basicAuthorization],
  })
  @post('vnpay/create_payment_url', {
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
    }) request: { transaction_id: string },
    @inject(SecurityBindings.USER)
    currentUserProfile: UserProfile,
  ): Promise<AppResponse> {
    const transaction = await this.transactionRepository.findById(request.transaction_id);

    if(currentUserProfile[securityId] != transaction.userId)
      throw new AppResponse(401,"Access denied!")

    if(transaction.payment)
      throw new AppResponse(400,"This booking already payment");

    if(transaction.status == MyDefault.TRANSACTION_STATUS.CANCELLED || transaction.status == MyDefault.TRANSACTION_STATUS.SUCCESS)
      throw new AppResponse(400,"This booking cannot payment");

    var ipAddr = this.req.headers['x-forwarded-for'] ||
    this.req.connection.remoteAddress ||
    this.req.socket.remoteAddress ||
    (this.req.connection as any).socket.remoteAddress;
    var dateFormat = require('dateformat');


    var config = require('../../src/services/vnpayconfig.json');
    var tmnCode = config.vnp_TmnCode;
    var secretKey = config.vnp_HashSecret;
    var vnpUrl = config.vnp_Url;
    var returnUrl = config.vnp_ReturnUrl;

    const date = new Date();
    var vnp_Params :any = {};
    vnp_Params['vnp_Version'] = '2';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    // vnp_Params['vnp_Merchant'] = ''
    vnp_Params['vnp_Locale'] = 'en';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = dateFormat(date, 'HHmmss') + '_' + transaction.id;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan booking #'+transaction.booking_reference;
    vnp_Params['vnp_OrderType'] = 'billpayment';
    vnp_Params['vnp_Amount'] = transaction.price * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = dateFormat(date, 'yyyymmddHHmmss');

    vnp_Params = this.sortObject(vnp_Params);

    var querystring = require('qs');
    var signData = secretKey + querystring.stringify(vnp_Params, { encode: false });

    var sha256 = require('sha256');

    var secureHash = sha256(signData);

    vnp_Params['vnp_SecureHashType'] =  'SHA256';
    vnp_Params['vnp_SecureHash'] = secureHash;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: true });

    return new AppResponse(200,"abc",{vnpayUrl: vnpUrl});
  }

  @get('vnpay/return', {
    responses: {
      '200': {
        description: 'return'
      }
    }
  })
  async result(): Promise<any> {
    var vnp_Params = this.req.query;
    var secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = this.sortObject(vnp_Params);

    var config = require('../../src/services/vnpayconfig.json');
    var secretKey = config.vnp_HashSecret;
    var querystring = require('qs');
    var signData = secretKey + querystring.stringify(vnp_Params, { encode: false });

    var sha256 = require('sha256');

    var checkSum = sha256(signData);

    if(secureHash === checkSum){
      var rspCode = vnp_Params['vnp_ResponseCode'];
      if(rspCode == '00')
        return 'Thanh toán thành công';
      else
        return 'Thanh toán thất bại';
    }
    else {
      return 'Sai chữ ký';
    }
  }

  @get('vnpay/ipn', {
    responses: {
      '200': {
        description: 'Room model instance',
      },
    },
  })
  async callback(
  ): Promise<any> {
    console.log('ipn');
    var vnp_Params = this.req.query;
    var secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = this.sortObject(vnp_Params);

    var config = require('../../src/services/vnpayconfig.json');
    var secretKey = config.vnp_HashSecret;
    var querystring = require('qs');
    var signData = secretKey + querystring.stringify(vnp_Params, { encode: false });

    var sha256 = require('sha256');

    var checkSum = sha256(signData);

    try{
      if(secureHash === checkSum){
        const transaction_id = vnp_Params['vnp_TxnRef'].split("_")[1];
        var rspCode = vnp_Params['vnp_ResponseCode'];
        if(rspCode == '00' && transaction_id != undefined){
          this.transactionRepository.updateById(transaction_id,{payment: true});
        }
        //Kiem tra du lieu co hop le khong, cap nhat trang thai don hang va gui ket qua cho VNPAY theo dinh dang duoi
        return {RspCode: '00', Message: 'success'};
      }
      else {
        return {RspCode: '97', Message: 'Fail checksum'};
      }
    }catch(e){
      return {RspCode: '99', Message: e.message};
    }
  }

  sortObject(o :any) {
    var sorted :any = {},
        key, a = [];

    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }

    a.sort();

    for (key = 0; key < a.length; key++) {
        sorted[a[key]] = o[a[key]];
    }
      return sorted;
  }
}
