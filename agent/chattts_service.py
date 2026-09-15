"""Small localhost-only ChatTTS adapter used by VivoFlow.

The model is loaded on the first prepare/synthesize request so starting the
dashboard does not allocate several GB of VRAM until voice output is enabled.
"""

from __future__ import annotations

import json
import os
import random
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

try:
    import torch
    import ChatTTS
    from ChatTTS.core import InferCodeParams
except Exception as exc:  # pragma: no cover - reported through /health
    torch = None
    ChatTTS = None
    InferCodeParams = None
    IMPORT_ERROR = str(exc)
else:
    IMPORT_ERROR = ""

HOST = "127.0.0.1"
PORT = int(os.environ.get("VIVOFLOW_CHATTTS_PORT", "8791"))
LOCK = threading.Lock()
MODEL = None
INFER_PARAMS = None
DEVICE = "unavailable"
ERROR = IMPORT_ERROR


def choose_device(requested: str) -> str:
    requested = requested if requested in {"auto", "cpu", "cuda"} else "auto"
    if requested == "cpu":
        return "cpu"
    if requested == "cuda":
        return "cuda" if torch is not None and torch.cuda.is_available() else "unavailable"
    if requested == "auto" and torch is not None and torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load_model(requested: str = "auto") -> bool:
    global MODEL, INFER_PARAMS, DEVICE, ERROR
    with LOCK:
        requested = requested if requested in {"auto", "cpu", "cuda"} else "auto"
        # An explicit device change should take effect without restarting the
        # bridge.  Auto keeps the already selected device (including a CUDA
        # to CPU fallback after an out-of-memory error).
        if MODEL is not None:
            if requested == "auto" or choose_device(requested) == DEVICE:
                return True
            MODEL = None
            INFER_PARAMS = None
            if torch is not None and torch.cuda.is_available():
                torch.cuda.empty_cache()
        if ChatTTS is None or torch is None:
            ERROR = IMPORT_ERROR or "chattts_import_failed"
            return False
        selected = choose_device(requested)
        if selected == "unavailable":
            DEVICE = "unavailable"
            ERROR = "cuda_unavailable"
            return False
        devices = [selected]
        if requested == "auto" and devices[0] == "cuda":
            devices.append("cpu")
        last_error = "chattts_model_download_failed"
        for device in devices:
            DEVICE = device
            try:
                MODEL = ChatTTS.Chat()
                # ChatTTS versions in the wild expose either load or load_models.
                if hasattr(MODEL, "load"):
                    ok = MODEL.load(source="huggingface", compile=False, device=torch.device(DEVICE))
                else:
                    ok = MODEL.load_models(compile=False, device=torch.device(DEVICE))
                if ok is False:
                    raise RuntimeError("chattts_model_download_failed")
                INFER_PARAMS = None
                if hasattr(MODEL, "sample_random_speaker") and InferCodeParams is not None:
                    # Keep one reproducible speaker embedding for this app
                    # instead of changing voice on every process restart.
                    random.seed(20240915)
                    np.random.seed(20240915)
                    torch.manual_seed(20240915)
                    if torch.cuda.is_available():
                        torch.cuda.manual_seed_all(20240915)
                    speaker = MODEL.sample_random_speaker()
                    INFER_PARAMS = InferCodeParams(spk_emb=speaker)
                ERROR = ""
                return True
            except Exception as exc:  # model downloads can fail transiently
                last_error = str(exc)
                MODEL = None
                INFER_PARAMS = None
                if device == "cuda" and torch.cuda.is_available():
                    torch.cuda.empty_cache()
        ERROR = last_error
        DEVICE = "unavailable"
        return False


def synthesize(text: str, requested: str) -> bytes:
    if not load_model(requested):
        raise RuntimeError(ERROR or "chattts_not_ready")
    with LOCK:
        kwargs = {"split_text": True}
        if INFER_PARAMS is not None:
            kwargs["params_infer_code"] = INFER_PARAMS
        try:
            wavs = MODEL.infer([text], **kwargs)
        except TypeError:
            # Keep compatibility with older ChatTTS releases that do not expose
            # split_text or named inference parameters.
            wavs = MODEL.infer([text])
        audio = np.asarray(wavs[0], dtype=np.float32)
    audio = np.clip(audio, -1.0, 1.0)
    pcm = (audio * 32767.0).astype("<i2").tobytes()
    output = __import__("io").BytesIO()
    with wave.open(output, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(24000)
        stream.writeframes(pcm)
    return output.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return

    def send_json(self, status: int, value: dict) -> None:
        data = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self.send_json(404, {"error": "not_found"})
            return
        self.send_json(200, {"ready": MODEL is not None, "loaded": MODEL is not None, "device": DEVICE, "error": ERROR})

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 2 * 1024 * 1024:
                self.send_json(413, {"error": "request_too_large"})
                return
            payload = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/prepare":
                ok = load_model(str(payload.get("device", "auto")))
                self.send_json(200 if ok else 503, {"ok": ok, "device": DEVICE, "error": ERROR})
                return
            if self.path == "/synthesize":
                text = str(payload.get("text", "")).strip()
                if not text or len(text) > 4000:
                    self.send_json(400, {"error": "text_required"})
                    return
                audio = synthesize(text, str(payload.get("device", "auto")))
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(audio)))
                self.end_headers()
                self.wfile.write(audio)
                return
            self.send_json(404, {"error": "not_found"})
        except Exception as exc:
            self.send_json(503, {"error": str(exc)})


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
