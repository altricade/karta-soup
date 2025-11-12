export interface Transaction {
  time: string;
  amount: number;
  locationName: string[];
  trnType: number;
  mcc: string;
  currency: string;
  merchantId: string;
  reversal: boolean;
  posRechargeReceipt: any;
  credit: boolean;
  locationCity: string;
}

export interface BalanceData {
  phone: string;
  balance: {
    availableAmount: number;
  };
  history: Transaction[];
  smsInfoStatus: string;
  smsNotificationAvailable: boolean;
  cardType: string;
}

export interface BalanceResponse {
  status: string;
  data: BalanceData;
}
