/**
 * Embeddings module
 * Provides local embedding generation using Transformers.js
 */

export * from './types.js';
export * from './transformers.js';

import { EmbeddingProvider, EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from './types.js';
import { TransformersEmbeddingProvider } from './transformers.js';

/**
 * Get an embedding provider based on configuration
 */
export async function getEmbeddingProvider(
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingProvider> {
  const mergedConfig = { ...DEFAULT_EMBEDDING_CONFIG, ...config };

  // For now, only Transformers.js is implemented
  // Ollama support can be added later
  if (mergedConfig.provider === 'ollama') {
    console.warn('Ollama provider not yet implemented, falling back to Transformers.js');
  }

  const provider = new TransformersEmbeddingProvider(mergedConfig.model);
  await provider.initialize();

  return provider;
}
