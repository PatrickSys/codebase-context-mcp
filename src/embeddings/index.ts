export * from './types.js';
export * from './transformers.js';

import { EmbeddingProvider, EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from './types.js';
import { TransformersEmbeddingProvider } from './transformers.js';

let cachedProvider: EmbeddingProvider | null = null;
let cachedProviderType: string | null = null;

export async function getEmbeddingProvider(
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingProvider> {
  const mergedConfig = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  const providerKey = `${mergedConfig.provider}:${mergedConfig.model}`;

  if (cachedProvider && cachedProviderType === providerKey) {
    return cachedProvider;
  }

  if (mergedConfig.provider === 'openai') {
    const { OpenAIEmbeddingProvider } = await import('./openai.js');
    const provider = new OpenAIEmbeddingProvider(
      mergedConfig.model || 'text-embedding-3-small',
      mergedConfig.apiKey,
      mergedConfig.apiEndpoint
    );
    await provider.initialize();
    cachedProvider = provider;
    cachedProviderType = providerKey;
    return provider;
  }

  if (mergedConfig.provider === 'custom') {
    throw new Error("Custom provider not implemented. Use 'openai' or 'transformers'.");
  }

  if (mergedConfig.provider === 'ollama') {
    console.warn('Ollama provider not yet implemented, falling back to Transformers.js');
  }

  const provider = new TransformersEmbeddingProvider(mergedConfig.model);
  await provider.initialize();
  cachedProvider = provider;
  cachedProviderType = providerKey;

  return provider;
}

