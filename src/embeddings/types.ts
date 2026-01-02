export interface EmbeddingProvider {
  readonly name: string;
  readonly modelName: string;
  readonly dimensions: number;

  initialize(): Promise<void>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isReady(): boolean;
}

export interface EmbeddingConfig {
  provider: 'transformers' | 'ollama' | 'openai' | 'custom';
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  apiKey?: string;
  apiEndpoint?: string;
}

export const DEFAULT_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/bge-small-en-v1.5';

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: (process.env.EMBEDDING_PROVIDER as any) || 'transformers',
  model: DEFAULT_MODEL,
  batchSize: 32,
  maxRetries: 3,
  apiKey: process.env.OPENAI_API_KEY
};
