import { AuthService } from '../auth/auth.service';

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
}

export class AuthInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(request: HttpRequest): HttpRequest {
    const accessToken = this.authService.getAccessToken();
    if (!accessToken) {
      return request;
    }

    return {
      ...request,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${accessToken}`
      }
    };
  }

  handleUnauthorized(statusCode: number): void {
    if (statusCode === 401) {
      this.authService.logout();
    }
  }
}
