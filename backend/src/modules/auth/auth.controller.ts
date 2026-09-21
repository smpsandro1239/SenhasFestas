import { Controller, Post, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, IsEmail, MinLength, IsOptional, IsIn } from 'class-validator';
import { Request, Response } from 'express';

export const TOKEN_COOKIE = 'sf_token';
export const REFRESH_COOKIE = 'sf_refresh';
const TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function cookieEhSeguro(req: Request): boolean {
  return process.env.NODE_ENV === 'production' || req.secure || req.get('x-forwarded-proto') === 'https';
}

// Sem Domain: cookie host-only. Em produção o frontend serve /api via rewrite
// (same-origin), por isso o cookie é gravado no domínio do frontend e chega ao
// middleware e à API. Não usar Domain=.vercel.app — a PSL rejeita.
export function definirCookieToken(res: Response, token: string, req: Request): void {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: cookieEhSeguro(req),
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_COOKIE_MAX_AGE,
  });
}

export function definirCookieRefresh(res: Response, refreshToken: string, req: Request): void {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: cookieEhSeguro(req),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function limparCookiesSessao(res: Response): void {
  res.clearCookie(TOKEN_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
  res.clearCookie(REFRESH_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
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

  private refreshTokenDe(req: Request, dto?: RefreshTokenDto): string {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    return cookie || dto?.refreshToken || '';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto.email, loginDto.password);
    definirCookieToken(res, result.token, req);
    definirCookieRefresh(res, result.refreshToken, req);
    return { token: result.token, user: result.user };
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
    definirCookieRefresh(res, result.refreshToken, req);
    return { token: result.token, user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto?: RefreshTokenDto) {
    const refreshToken = this.refreshTokenDe(req, dto);
    const result = await this.authService.refresh(refreshToken);
    definirCookieToken(res, result.token, req);
    definirCookieRefresh(res, result.refreshToken, req);
    return { token: result.token, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto?: RefreshTokenDto) {
    const refreshToken = this.refreshTokenDe(req, dto);
    limparCookiesSessao(res);
    return this.authService.logout(refreshToken);
  }
}