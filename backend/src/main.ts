import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for Angular frontend
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });

  // Global prefix — all routes become /api/auth/login, /api/auth/signup, etc.
  app.setGlobalPrefix('api');

  // This makes your DTO validators work globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on extra properties
      transform: true,       // Auto-convert types (string -> number, etc.)
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 BIAT CV Platform API running on http://localhost:${port}/api`);
}
bootstrap();