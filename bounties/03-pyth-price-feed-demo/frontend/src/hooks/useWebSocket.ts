import { useState, useEffect, useRef } from 'react';
import { WS_URL } from '../lib/env';

export const useWebSocket = (url: string = WS_URL) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyState, setReadyState] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setReadyState(ws.readyState);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (e) {
          setLastMessage(event.data);
        }
      };

      ws.onerror = (event) => {
        setError('WebSocket error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setReadyState(3);
      };

      return () => {
        ws.close();
      };
    } catch (err: any) {
      setError(err.message);
    }
  }, [url]);

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      wsRef.current.send(data);
    }
  };

  const reconnect = () => {
    setError(null);
  };

  return {
    isConnected,
    sendMessage,
    lastMessage,
    error,
    readyState,
    reconnect,
  };
};