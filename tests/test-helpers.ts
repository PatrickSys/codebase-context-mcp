import { promises as fs } from 'fs';

export async function rmWithRetries(targetPath: string): Promise<void> {
  const maxAttempts = 8;
  let delayMs = 25;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      const retryable = code === 'ENOTEMPTY' || code === 'EPERM' || code === 'EBUSY';
      if (!retryable || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}
