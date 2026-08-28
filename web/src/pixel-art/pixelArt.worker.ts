import { processPixelArt } from "./pipeline";
import type { PixelArtWorkerRequest, PixelArtWorkerResponse } from "./types";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PixelArtWorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event: MessageEvent<PixelArtWorkerRequest>) => {
  const request = event.data;
  try {
    const result = processPixelArt(request.imageData, request.settings);
    const response: PixelArtWorkerResponse = { requestId: request.requestId, result };
    workerScope.postMessage(response, [result.data.buffer as ArrayBuffer]);
  } catch (error) {
    workerScope.postMessage({ requestId: request.requestId, error: error instanceof Error ? error.message : String(error) });
  }
};
