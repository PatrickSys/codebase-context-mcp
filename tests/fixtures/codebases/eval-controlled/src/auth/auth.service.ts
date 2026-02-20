import { LocalStorageService } from '../storage/local-storage.service';

export interface SessionToken {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static readonly TOKEN_KEY = 'session-token';

  constructor(private readonly storage: LocalStorageService) {}

  login(email: string, password: string): SessionToken {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const token: SessionToken = {
      accessToken: `access-${email}`,
      refreshToken: `refresh-${email}`
    };

    this.storage.set<SessionToken>(AuthService.TOKEN_KEY, token);
    return token;
  }

  logout(): void {
    this.storage.remove(AuthService.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.storage.has(AuthService.TOKEN_KEY);
  }

  getAccessToken(): string | null {
    const token = this.storage.get<SessionToken>(AuthService.TOKEN_KEY);
    return token?.accessToken ?? null;
  }
}
