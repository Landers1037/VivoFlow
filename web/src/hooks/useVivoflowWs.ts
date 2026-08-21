import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig, ConnState, Snapshot } from "@/types";

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function useVivoflowWs() {
  const [conn, setConn] = useState<ConnState>("connecting");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const historyLimit = useRef(60);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const applySnapshot = useCallback((snap: Snapshot) => {
    setSnapshot(snap);
    setHistory((prev) => {
      const next = [...prev, snap];
      const limit = historyLimit.current;
      return next.length > limit ? next.slice(next.length - limit) : next;
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
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
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "snapshot") {
          applySnapshot(msg as Snapshot);
        } else if (msg.type === "config" && msg.config) {
          setConfig(msg.config as AppConfig);
          historyLimit.current = msg.config.history_points ?? 60;
        } else if (msg.type === "error") {
          setError(msg.message ?? "未知错误");
        }
      } catch {
        setError("无法解析服务器消息");
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
      setError("WebSocket 连接失败");
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

  return { conn, snapshot, history, config, error, setRemoteConfig, reconnect: connect };
}
