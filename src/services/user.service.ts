import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findByTelegramId(telegramId: string): Promise<User> {
    return this.userRepository.findOne({ where: { telegramId } });
  }

  async createUser(telegramId: string, username?: string, firstName?: string, lastName?: string): Promise<User> {
    const user = this.userRepository.create({
      telegramId,
      username,
      firstName,
      lastName,
    });
    return this.userRepository.save(user);
  }

  async updateKartaSoupCode(telegramId: string, code: string): Promise<User> {
    let user = await this.findByTelegramId(telegramId);
    
    if (!user) {
      user = await this.createUser(telegramId);
    }

    user.kartaSoupCode = code;
    return this.userRepository.save(user);
  }

  async getKartaSoupCode(telegramId: string): Promise<string | null> {
    const user = await this.findByTelegramId(telegramId);
    return user?.kartaSoupCode || null;
  }
}
