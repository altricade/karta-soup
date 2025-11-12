import { Update, Ctx, Start, Help, Command, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UserService } from '../services/user.service';
import { KartaSoupService } from '../services/karta-soup.service';
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

  constructor(
    private readonly userService: UserService,
    private readonly kartaSoupService: KartaSoupService,
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
      await ctx.reply('Пожалуйста, отправьте код вашей карты Карта Суп:');
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
    const code = await this.userService.getKartaSoupCode(telegramId);

    if (!code) {
      await ctx.reply('У вас не сохранен код карты. Пожалуйста, отправьте код вашей карты:');
      this.userSessions.set(telegramId, { awaitingCode: true });
      return;
    }

    await this.fetchAndDisplayBalance(ctx, code);
  }

  @Command('changecode')
  async changeCode(@Ctx() ctx: Context) {
    const telegramId = ctx.from.id.toString();
    await ctx.reply('Отправьте новый код вашей карты Карта Суп:');
    this.userSessions.set(telegramId, { awaitingCode: true });
  }

  @Action('check_balance')
  async onCheckBalance(@Ctx() ctx: any) {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    const code = await this.userService.getKartaSoupCode(telegramId);

    if (!code) {
      await ctx.reply('У вас не сохранен код карты. Пожалуйста, отправьте код вашей карты:');
      this.userSessions.set(telegramId, { awaitingCode: true });
      return;
    }

    await this.fetchAndDisplayBalance(ctx, code);
  }

  @Action('change_code')
  async onChangeCode(@Ctx() ctx: any) {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    await ctx.reply('Отправьте новый код вашей карты Карта Суп:');
    this.userSessions.set(telegramId, { awaitingCode: true });
  }

  @On('text')
  async onText(@Ctx() ctx: Context & { message: { text: string } }) {
    const telegramId = ctx.from.id.toString();
    const session = this.userSessions.get(telegramId);

    if (session?.awaitingCode) {
      const code = ctx.message.text.trim();
      
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

  private async fetchAndDisplayBalance(ctx: Context, code: string) {
    try {
      await ctx.reply('Получаю данные... ⏳');
      const balanceData = await this.kartaSoupService.getBalance(code);
      await this.displayBalance(ctx, balanceData);
    } catch (error) {
      this.logger.error('Error fetching balance:', error);
      await ctx.reply('❌ Не удалось получить баланс. Попробуйте позже.');
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
