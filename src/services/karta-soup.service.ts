import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BalanceResponse } from '../interfaces/balance.interface';

@Injectable()
export class KartaSoupService {
  private readonly logger = new Logger(KartaSoupService.name);
  private readonly baseUrl = 'https://meal.gift-cards.ru/api/1/cards';

  async getBalance(code: string): Promise<BalanceResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/${code}?limit=100`, {
        headers: {
          'accept': 'application/json;text/html;*/*',
          'accept-language': 'en-US,en;q=0.9,ru;q=0.8,ar;q=0.7',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'referer': 'https://meal.gift-cards.ru/balance',
          'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest'
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch balance for code ${code}:`, error.message);
      throw new Error('Не удалось получить баланс. Проверьте правильность кода.');
    }
  }

  formatBalance(balance: number): string {
    return `${balance.toFixed(2)} ₽`;
  }

  formatTransaction(transaction: any): string {
    const date = new Date(transaction.time);
    const formattedDate = date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const amount = transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount;
    const location = transaction.locationName.join(', ');
    const city = transaction.locationCity;

    return `${formattedDate}\n${amount} ₽ | ${location}\n${city}`;
  }
}
