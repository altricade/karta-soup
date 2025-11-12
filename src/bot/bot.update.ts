import { Update, Ctx, Start, Help, Command, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UserService } from '../services/user.service';
import { KartaSoupService } from '../services/karta-soup.service';
import { BarcodeService } from '../services/barcode.service';
import { Logger } from '@nestjs/common';

interface SessionContext extends Context {
  session?: {
    awaitingCode?: boolean;
  };
}

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);
  private userSessions: Map<string, { awaitingCode: boolean }> = new Map();
  private lastBalanceCheck: Map<string, { timestamp: number; success: boolean }> = new Map();

  constructor(
    private readonly userService: UserService,
    private readonly kartaSoupService: KartaSoupService,
    private readonly barcodeService: BarcodeService,
  ) {}

  @Start()
  async start(@Ctx() ctx: SessionContext) {
    const telegramId = ctx.from.id.toString();
    
    let user = await this.userService.findByTelegramId(telegramId);
    
    if (!user) {
      user = await this.userService.createUser(
        telegramId,
        ctx.from.username,
        ctx.from.first_name,
        ctx.from.last_name,
      );
    }

    const welcomeMessage = `Добро пожаловать в бот Карта Суп! 🍲

Я помогу вам проверить баланс и историю транзакций вашей карты.

Используйте кнопки ниже для управления:`;

    if (user.kartaSoupCode) {
      await ctx.reply(welcomeMessage, this.getMainMenu());
    } else {
      await ctx.reply(welcomeMessage);
      await ctx.reply(
        'Пожалуйста, отправьте код вашей карты Карта Суп (13 цифр, начинается с 2001) или отправьте фото штрих-кода карты 📸',
        Markup.keyboard([
          [Markup.button.text('📷 Отправить фото')],
        ]).resize()
      );
      this.userSessions.set(telegramId, { awaitingCode: true });
    }
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply(
      `Доступные команды:

/start - Начать работу с ботом
/balance - Проверить баланс
/changecode - Изменить код карты
/help - Показать эту справку`,
      this.getMainMenu()
    );
  }

  @Command('balance')
  async checkBalance(@Ctx() ctx: Context) {
    const telegramId = ctx.from.id.toString();
    
    const rateLimitMessage = this.checkRateLimit(telegramId);
    if (rateLimitMessage) {
      await ctx.reply(rateLimitMessage);
      return;
    }

    const code = await this.userService.getKartaSoupCode(telegramId);

    if (!code) {
      await ctx.reply('У вас не сохранен код карты. Пожалуйста, отправьте код вашей карты:');
      this.userSessions.set(telegramId, { awaitingCode: true });
      return;
    }

    await this.fetchAndDisplayBalance(ctx, code, telegramId);
  }

  @Command('changecode')
  async changeCode(@Ctx() ctx: Context) {
    const telegramId = ctx.from.id.toString();
    await ctx.reply(
      'Отправьте новый код вашей карты Карта Суп (13 цифр, начинается с 2001) или отправьте фото штрих-кода карты 📸',
      Markup.keyboard([
        [Markup.button.text('📷 Отправить фото')],
      ]).resize()
    );
    this.userSessions.set(telegramId, { awaitingCode: true });
  }

  @Action('check_balance')
  async onCheckBalance(@Ctx() ctx: any) {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    
    const rateLimitMessage = this.checkRateLimit(telegramId);
    if (rateLimitMessage) {
      await ctx.reply(rateLimitMessage);
      return;
    }

    const code = await this.userService.getKartaSoupCode(telegramId);

    if (!code) {
      await ctx.reply('У вас не сохранен код карты. Пожалуйста, отправьте код вашей карты:');
      this.userSessions.set(telegramId, { awaitingCode: true });
      return;
    }

    await this.fetchAndDisplayBalance(ctx, code, telegramId);
  }

  @Action('change_code')
  async onChangeCode(@Ctx() ctx: any) {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    await ctx.reply(
      'Отправьте новый код вашей карты Карта Суп (13 цифр, начинается с 2001) или отправьте фото штрих-кода карты 📸',
      Markup.keyboard([
        [Markup.button.text('📷 Отправить фото')],
      ]).resize()
    );
    this.userSessions.set(telegramId, { awaitingCode: true });
  }

  @On('text')
  async onText(@Ctx() ctx: Context & { message: { text: string } }) {
    const telegramId = ctx.from.id.toString();
    const session = this.userSessions.get(telegramId);

    if (session?.awaitingCode) {
      const code = ctx.message.text.trim();
      
      const validationError = this.validateCardCode(code);
      if (validationError) {
        await ctx.reply(validationError);
        return;
      }
      
      try {
        await ctx.reply('Проверяю код... ⏳');
        
        const balanceData = await this.kartaSoupService.getBalance(code);
        
        await this.userService.updateKartaSoupCode(telegramId, code);
        
        this.userSessions.delete(telegramId);
        
        await ctx.reply(`✅ Код успешно сохранен!`);
        await this.displayBalance(ctx, balanceData);
      } catch (error) {
        this.logger.error(`Error saving code for user ${telegramId}:`, error);
        await ctx.reply(
          '❌ Не удалось проверить код. Убедитесь, что код введен правильно и попробуйте снова.'
        );
      }
    }
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: Context & { message: any; telegram: any }) {
    const telegramId = ctx.from.id.toString();
    const session = this.userSessions.get(telegramId);

    if (session?.awaitingCode) {
      try {
        await ctx.reply('Сканирую штрих-код... 🔍');

        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        
        const barcode = await this.barcodeService.scanBarcodeFromUrl(fileLink.href);

        if (!barcode) {
          await ctx.reply(
            '❌ Не удалось распознать штрих-код на фото.\n\nПопробуйте:\n• Сделать фото при хорошем освещении\n• Держать камеру ровно\n• Убедиться, что штрих-код четко виден\n\nИли введите код вручную (13 цифр).'
          );
          return;
        }

        const validationError = this.validateCardCode(barcode);
        if (validationError) {
          await ctx.reply(
            `${validationError}\n\nРаспознанный код: ${barcode}\n\nПожалуйста, введите код вручную.`
          );
          return;
        }

        await ctx.reply('Проверяю код... ⏳');
        
        const balanceData = await this.kartaSoupService.getBalance(barcode);
        
        await this.userService.updateKartaSoupCode(telegramId, barcode);
        
        this.userSessions.delete(telegramId);
        
        await ctx.reply(`✅ Код успешно сохранен!\nРаспознанный код: ${barcode}`, Markup.removeKeyboard());
        await this.displayBalance(ctx, balanceData);
      } catch (error) {
        this.logger.error(`Error processing barcode for user ${telegramId}:`, error);
        await ctx.reply(
          '❌ Не удалось обработать фото. Попробуйте снова или введите код вручную.'
        );
      }
    }
  }

  private validateCardCode(code: string): string | null {
    if (!/^\d{13}$/.test(code)) {
      return '❌ Код карты должен содержать ровно 13 цифр.';
    }

    if (!code.startsWith('2001')) {
      return '❌ Код карты должен начинаться с 2001.';
    }

    return null;
  }

  private checkRateLimit(telegramId: string): string | null {
    const lastCheck = this.lastBalanceCheck.get(telegramId);
    
    if (!lastCheck) {
      return null;
    }

    const now = Date.now();
    const timePassed = now - lastCheck.timestamp;
    
    const requiredDelay = lastCheck.success ? 60000 : 10000;
    const remainingTime = requiredDelay - timePassed;

    if (remainingTime > 0) {
      const seconds = Math.ceil(remainingTime / 1000);
      return `⏳ Пожалуйста, подождите ${seconds} секунд перед следующей проверкой баланса.`;
    }

    return null;
  }

  private async fetchAndDisplayBalance(ctx: Context, code: string, telegramId: string) {
    try {
      await ctx.reply('Получаю данные... ⏳');
      const balanceData = await this.kartaSoupService.getBalance(code);
      await this.displayBalance(ctx, balanceData);
      
      this.lastBalanceCheck.set(telegramId, {
        timestamp: Date.now(),
        success: true
      });
    } catch (error) {
      this.logger.error('Error fetching balance:', error);
      await ctx.reply('❌ Не удалось получить баланс. Попробуйте позже.');
      
      this.lastBalanceCheck.set(telegramId, {
        timestamp: Date.now(),
        success: false
      });
    }
  }

  private async displayBalance(ctx: Context, balanceData: any) {
    const balance = balanceData.data.balance.availableAmount;
    const phone = balanceData.data.phone;
    const history = balanceData.data.history;

    let message = `💳 Баланс карты\n\n`;
    message += `📱 Телефон: ${phone}\n\n`;
    message += `📊 Последние транзакции:\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const recentTransactions = history.slice(0, 10).reverse();
    
    for (const transaction of recentTransactions) {
      message += this.kartaSoupService.formatTransaction(transaction);
      message += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    if (history.length > 10) {
      message += `... и еще ${history.length - 10} транзакций\n\n`;
    }

    message += `💰 Доступно: ${this.kartaSoupService.formatBalance(balance)}`;

    await ctx.reply(message, this.getMainMenu());
  }

  private getMainMenu() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('💰 Проверить баланс', 'check_balance')],
      [Markup.button.callback('🔄 Изменить код', 'change_code')],
    ]);
  }
}
