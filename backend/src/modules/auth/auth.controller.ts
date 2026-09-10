import { Controller, Post, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, IsEmail, MinLength, IsOptional, IsIn } from 'class-validator';
import { Request, Response } from 'express';

export const TOKEN_COOKIE = 'sf_token';
const TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function cookieEhSeguro(req: Request): boolean {
  return process.env.NODE_ENV === 'production' || req.secure || req.get('x-forwarded-proto') === 'https';
}

export function definirCookieToken(res: Response, token: string, req: Request): void {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: cookieEhSeguro(req),
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_COOKIE_MAX_AGE,
  });
}

export function limparCookieToken(res: Response): void {
  res.clearCookie(TOKEN_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['client'])
  role?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto.email, loginDto.password);
    definirCookieToken(res, result.token, req);
    return result;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() registerDto: RegisterDto) {
    const result = await this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.name,
      registerDto.role,
      registerDto.phone,
    );
    definirCookieToken(res, result.token, req);
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    definirCookieToken(res, result.token, req);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response, @Body() dto: RefreshTokenDto) {
    limparCookieToken(res);
    return this.authService.logout(dto.refreshToken);
  }
}