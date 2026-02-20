import { PlayerApi } from '../player/player-api';

export interface Album {
  id: string;
  title: string;
}

interface AlbumState {
  savedAlbums: Album[];
  loading: boolean;
}

export class AlbumStore {
  private state: AlbumState = {
    savedAlbums: [],
    loading: false
  };

  constructor(private readonly playerApi: PlayerApi) {}

  dispatchLoadSavedAlbums(): void {
    this.state.loading = true;
    this.playerApi.getRecentlyPlayed();
  }

  reduceSavedAlbums(albums: Album[]): void {
    this.state.savedAlbums = albums;
    this.state.loading = false;
  }

  selectSavedAlbums(): Album[] {
    return this.state.savedAlbums;
  }

  selectAlbumCount(): number {
    return this.state.savedAlbums.length;
  }
}
