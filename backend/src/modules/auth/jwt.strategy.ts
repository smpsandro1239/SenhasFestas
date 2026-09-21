import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TOKEN_COOKIE } from './auth.controller';

function cookieExtractor(req: any): string | null {
  const cookieValue = req?.cookies?.[TOKEN_COOKIE];
  if (typeof cookieValue === 'string' && cookieValue.length > 0) {
    return cookieValue;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('Configuração inválida: define JWT_SECRET no .env');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
      issuer: 'senhasfestas-api',
      audience: 'senhasfestas-app',
    });
  }

  async validate(payload: any) {
    return this.authService.validateUser(payload);
  }
}