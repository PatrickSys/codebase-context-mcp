import { AuthInterceptor, HttpRequest } from '../http/auth.interceptor';

export interface PlaybackDevice {
  id: string;
  name: string;
}

export class PlayerApi {
  constructor(private readonly authInterceptor: AuthInterceptor) {}

  nextTrack(): HttpRequest {
    return this.authorizedRequest('/v1/me/player/next');
  }

  setVolume(volumePercent: number): HttpRequest {
    return this.authorizedRequest(`/v1/me/player/volume?volume_percent=${volumePercent}`);
  }

  transferPlayback(device: PlaybackDevice): HttpRequest {
    return this.authorizedRequest(`/v1/me/player?device_id=${device.id}`);
  }

  getRecentlyPlayed(): HttpRequest {
    return this.authorizedRequest('/v1/me/player/recently-played');
  }

  private authorizedRequest(url: string): HttpRequest {
    return this.authInterceptor.intercept({
      url,
      headers: {
        Accept: 'application/json'
      }
    });
  }
}
