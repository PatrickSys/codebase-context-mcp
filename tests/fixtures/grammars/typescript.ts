interface Config {
  host: string;
  port: number;
}

function createServer(config: Config): void {
  console.log(config.host);
}

class Server {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  start(): void {
    console.log('started');
  }
}
