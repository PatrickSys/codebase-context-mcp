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

  if (mergedConfig.provider === 'openai') {
    const { OpenAIEmbeddingProvider } = await import('./openai.js');
    const provider = new OpenAIEmbeddingProvider(
      mergedConfig.model === 'Xenova/bge-small-en-v1.5' ? 'text-embedding-3-small' : mergedConfig.model,
      mergedConfig.apiKey,
      mergedConfig.apiEndpoint
    );
    await provider.initialize();
    return provider;
  }

  if (mergedConfig.provider === 'custom') {
    throw new Error("Custom provider requires implementing 'IEmbeddingProvider' and bundling it. Use 'openai' or 'transformers' for now.");
  }

  // Ollama support can be added later
  if (mergedConfig.provider === 'ollama') {
    console.warn('Ollama provider not yet implemented, falling back to Transformers.js');
  }

  const provider = new TransformersEmbeddingProvider(mergedConfig.model);
  await provider.initialize();

  return provider;
}
