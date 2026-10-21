
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';

interface ChatHistoryItem {
  role: 'user' | 'model';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatHistoryItem[];
}

@Controller('ai')
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 15, ttl: 60000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequest) {
    if (
      typeof body?.message !== 'string' ||
      !body.message.trim()
    ) {
      throw new BadRequestException(
        'Trường message không được để trống.',
      );
    }

    if (body.message.length > 4000) {
      throw new BadRequestException(
        'Tin nhắn không được vượt quá 4000 ký tự.',
      );
    }

    const history = body.history ?? [];

    if (
      !Array.isArray(history) ||
      history.length > 20 ||
      history.some(
        (item) =>
          !item ||
          !['user', 'model'].includes(item.role) ||
          typeof item.content !== 'string' ||
          item.content.length > 4000,
      )
    ) {
      throw new BadRequestException(
        'Lịch sử hội thoại không hợp lệ.',
      );
    }

    const reply = await this.aiService.chat(
      body.message.trim(),
      history,
    );

    return { reply };
  }
}
