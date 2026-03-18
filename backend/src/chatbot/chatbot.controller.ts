// chatbot.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { RecommendDto }   from './dto/recommend.dto';
import { JwtAuthGuard }   from '../auth/jwt-auth.guard';

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('recommend')
  @HttpCode(HttpStatus.OK) // ✅ return 200 not 201
  async recommend(@Body() dto: RecommendDto) {
    return this.chatbotService.recommend(dto);
  }
}