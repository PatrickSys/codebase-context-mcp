/**
 * Thrown when the LanceDB index is corrupted or has a schema mismatch.
 * This error signals that re-indexing is required for semantic search to work.
 */
export class IndexCorruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IndexCorruptedError';
  }
}
