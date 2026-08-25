import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@/i18n/messages";
import type { AppConfig, AudioFrame, AudioStatus, ConnState, Snapshot } from "@/types";
import { DEFAULT_CONFIG } from "@/types";

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function mergeConfig(raw: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    enabled: { ...DEFAULT_CONFIG.enabled, ...(raw.enabled ?? {}) },
  };
}

export type WsError =
  | { kind: "key"; key: MessageKey }
  | { kind: "raw"; message: string };

export function useVivoflowWs() {
  const [conn, setConn] = useState<ConnState>("connecting");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<WsError | null>(null);
  const [audioFrame, setAudioFrame] = useState<AudioFrame | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const historyLimit = useRef(60);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const audioSubscribedRef = useRef(false);

  const applySnapshot = useCallback((snap: Snapshot) => {
    setSnapshot(snap);
    setHistory((prev) => {
      const next = [...prev, snap];
      const limit = historyLimit.current;
      return next.length > limit ? next.slice(next.length - limit) : next;
    });
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    setConn("connecting");
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConn("connected");
      setError(null);
      retryRef.current = 0;
      ws.send(JSON.stringify({ type: "hello", client: "web" }));
      ws.send(JSON.stringify({ type: "get_config" }));
      ws.send(JSON.stringify({ type: "get_snapshot" }));
      if (audioSubscribedRef.current) ws.send(JSON.stringify({ type: "set_audio_subscription", enabled: true }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "snapshot") {
          applySnapshot(msg as Snapshot);
        } else if (msg.type === "config" && msg.config) {
          const next = mergeConfig(msg.config as Partial<AppConfig>);
          setConfig(next);
          historyLimit.current = next.history_points ?? 60;
        } else if (msg.type === "error") {
          setError(
            msg.message
              ? { kind: "raw", message: String(msg.message) }
              : { kind: "key", key: "unknownError" },
          );
        } else if (msg.type === "audio_frame") {
          setAudioFrame(msg as AudioFrame);
        } else if (msg.type === "audio_status") {
          setAudioStatus(msg as AudioStatus);
        }
      } catch {
        setError({ kind: "key", key: "parseError" });
      }
    };

    ws.onclose = () => {
      setConn("disconnected");
      wsRef.current = null;
      const delay = Math.min(8000, 500 * 2 ** retryRef.current);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setError({ kind: "key", key: "wsFailed" });
    };
  }, [applySnapshot]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const setRemoteConfig = useCallback((next: AppConfig) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "set_config", config: next }));
  }, []);

  const setAudioSubscription = useCallback((enabled: boolean) => {
    audioSubscribedRef.current = enabled;
    if (!enabled) setAudioFrame(null);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "set_audio_subscription", enabled }));
  }, []);

  return { conn, snapshot, history, config, error, audioFrame, audioStatus, setAudioSubscription, setRemoteConfig, reconnect: connect };
}
