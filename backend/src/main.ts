import { NestFactory }      from '@nestjs/core';
import { ValidationPipe }   from '@nestjs/common';
import { ConfigService }     from '@nestjs/config';
import { AppModule }         from './app.module';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // ✅ FIX 8: CORS origin driven by environment variable.
  // Set CORS_ORIGIN in .env — supports comma-separated values for multi-origin.
  // Defaults to http://localhost:4200 for local development.
  const configService = app.get(ConfigService);
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:4200';
  const corsOrigins   = corsOriginEnv.split(',').map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global prefix — all routes become /api/auth/login, /api/auth/signup, etc.
  app.setGlobalPrefix('api');

  // This makes your DTO validators work globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on extra properties
      transform: true,            // Auto-convert types (string -> number, etc.)
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 BIAT CV Platform API running on http://localhost:${port}/api`);
  console.log(`🌍 CORS enabled for: ${corsOrigins.join(', ')}`);
}
bootstrap();