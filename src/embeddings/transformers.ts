/**
 * Transformers.js Embedding Provider
 * Uses local models via @xenova/transformers
 */

import { EmbeddingProvider } from "./types.js";

// Model configurations
const MODEL_CONFIGS: Record<string, { dimensions: number }> = {
  "Xenova/bge-small-en-v1.5": { dimensions: 384 },
  "Xenova/all-MiniLM-L6-v2": { dimensions: 384 },
  "Xenova/bge-base-en-v1.5": { dimensions: 768 },
};

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly name = "transformers";
  readonly modelName: string;
  readonly dimensions: number;

  private pipeline: any = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;

  constructor(modelName: string = "Xenova/bge-base-en-v1.5") {
    this.modelName = modelName;
    this.dimensions = MODEL_CONFIGS[modelName]?.dimensions || 384;
  }

  async initialize(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.error(`Loading embedding model: ${this.modelName}`);
      console.error("(First run will download ~130MB model)");

      // Dynamic import to avoid issues at require time
      const { pipeline } = await import("@xenova/transformers");

      // Create feature extraction pipeline
      this.pipeline = await pipeline("feature-extraction", this.modelName, {
        quantized: true, // Use quantized model for speed
      });

      this.ready = true;
      console.error(`Model loaded successfully: ${this.modelName}`);
    } catch (error) {
      console.error("Failed to initialize embedding model:", error);
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.ready) {
      await this.initialize();
    }

    try {
      // Get embeddings
      const output = await this.pipeline(text, {
        pooling: "mean",
        normalize: true,
      });

      // Convert to array
      return Array.from(output.data);
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.ready) {
      await this.initialize();
    }

    const embeddings: number[][] = [];

    // Process in smaller batches to manage memory
    const batchSize = 8;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Process batch
      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.embed(text))
      );

      embeddings.push(...batchEmbeddings);

      // Log progress for large batches
      if (texts.length > 100 && (i + batchSize) % 100 === 0) {
        console.error(
          `Embedded ${Math.min(i + batchSize, texts.length)}/${
            texts.length
          } chunks`
        );
      }
    }

    return embeddings;
  }

  isReady(): boolean {
    return this.ready;
  }
}

/**
 * Create an embedding provider based on config
 */
export async function createEmbeddingProvider(
  modelName: string = "Xenova/bge-base-en-v1.5"
): Promise<EmbeddingProvider> {
  const provider = new TransformersEmbeddingProvider(modelName);
  await provider.initialize();
  return provider;
}
