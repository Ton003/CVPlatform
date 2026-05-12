import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Maintain original app creation pattern as requested
  const app = await NestFactory.create(AppModule);

  // 1. Dependency Resolution
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  // 2. Security & Global Middleware
  app.use(cookieParser());

  // Define limits for large CV processing
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 3. Robust CORS Configuration
  const corsOriginEnv =
    configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:4200';
  const corsOrigins = corsOriginEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-api-key',
  });

  // 4. Global API Routing
  app.setGlobalPrefix('api');

  // 5. Strict Data Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 6. Graceful Shutdown Support
  app.enableShutdownHooks();

  // 7. Initialize Server
  await app.listen(port);

  logger.log(`🚀 BIAT TalentOS API running on http://localhost:${port}/api`);
  logger.log(`🌍 CORS enabled for: ${corsOrigins.join(', ')}`);
  logger.log(`🛡️  Payload protection active (50MB Limit)`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `❌ Critical failure during startup: ${err.message}`,
  );
  process.exit(1);
});
