/**
 * Types for embedding providers
 */

export interface EmbeddingProvider {
  readonly name: string;
  readonly modelName: string;
  readonly dimensions: number;

  /**
   * Initialize the provider (load model, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Check if provider is ready
   */
  isReady(): boolean;
}

export interface EmbeddingConfig {
  provider: "transformers" | "ollama" | "openai" | "custom";
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  apiKey?: string;
  apiEndpoint?: string;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: (process.env.EMBEDDING_PROVIDER as any) || "transformers",
  model: process.env.EMBEDDING_MODEL || "Xenova/bge-small-en-v1.5",
  batchSize: 32,
  maxRetries: 3,
  apiKey: process.env.OPENAI_API_KEY,
};
