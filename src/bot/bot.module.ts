import { Module } from "@nestjs/common";
import { TelegrafModule } from "nestjs-telegraf";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BotUpdate } from "./bot.update";
import { UserService } from "../services/user.service";
import { KartaSoupService } from "../services/karta-soup.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>("TELEGRAM_BOT_TOKEN"),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [BotUpdate, UserService, KartaSoupService],
})
export class BotModule {}
