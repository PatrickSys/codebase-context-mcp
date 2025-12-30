import { Worker } from "node:worker_threads";

/**
 * Parse JSON off the main thread to avoid blocking the event loop.
 *
 * Note: This still loads the full JSON string in memory. It primarily addresses
 * main-thread stalls from `JSON.parse` for larger payloads.
 */
export async function parseJsonInWorker<T>(json: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const worker = new Worker(
      `
        const { parentPort, workerData } = require("node:worker_threads");
        try {
          const value = JSON.parse(workerData);
          parentPort.postMessage({ ok: true, value });
        } catch (error) {
          parentPort.postMessage({
            ok: false,
            error: error && error.message ? error.message : String(error),
          });
        }
      `,
      { eval: true, workerData: json }
    );

    const cleanup = () => {
      worker.removeAllListeners();
      void worker.terminate();
    };

    worker.once("message", (msg: any) => {
      cleanup();
      if (msg?.ok) resolve(msg.value as T);
      else reject(new Error(msg?.error || "Failed to parse JSON"));
    });
    worker.once("error", (err) => {
      cleanup();
      reject(err);
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`JSON parse worker exited with code ${code}`));
      }
    });
  });
}

