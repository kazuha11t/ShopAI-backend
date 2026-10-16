import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
const app = await NestFactory.create(AppModule);

app.enableCors();

app.useGlobalPipes(
new ValidationPipe({
whitelist: true,
forbidNonWhitelisted: true,
transform: true,
}),
);
const swaggerConfig = new DocumentBuilder()
  .setTitle('ShopAI API')
  .setDescription('API documentation for ShopAI backend')
  .setVersion('1.0')
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, document);

const port = Number(process.env.PORT) || 3000;
await app.listen(port);

console.log(`ShopAI backend is running at http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application:', error);
  process.exitCode = 1;
});