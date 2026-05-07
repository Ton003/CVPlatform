import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EmployeesService } from './employees/employees.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(EmployeesService);
  
  console.log('Testing findAllManagers()...');
  const managers = await service.findAllManagers();
  console.log('Managers found:', JSON.stringify(managers, null, 2));
  
  await app.close();
}

bootstrap().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
