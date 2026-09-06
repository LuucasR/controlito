import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    // Guard GLOBAL: toda ruta nace protegida y hay que abrirla a propósito
    // con @Publico(). Al revés, olvidarse de proteger una ruta no da ningún
    // síntoma hasta que se filtran datos.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
