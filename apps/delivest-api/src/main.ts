/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DomainExceptionFilter } from './shared/exception/domain_exception/domain-exception.filter.js';
import { ApiExceptionFilter } from './shared/exception/api_exception/api-exception.filter.js';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter(), new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Delivest API')
    .setDescription('API for client app')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description:
          'Client JWT token (from /client/login or /client/register)',
        in: 'header',
      },
      'client-auth',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Staff JWT token (from /staff/login)',
        in: 'header',
      },
      'staff-auth',
    )
    .addCookieAuth('client_refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'client_refresh_token',
      description: 'Refresh token for Clients',
    })
    .addCookieAuth('staff_refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'staff_refresh_token',
      description: 'Refresh token for Staff',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      defaultModelsExpandDepth: -1,
      tryItOutEnabled: true,
    },
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`Docs available at: http://localhost:${port}/docs`);
}

bootstrap();
