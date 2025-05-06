import { useState, useEffect, useCallback } from 'react';

interface WebSocketHook {
  isConnected: boolean;
  error: Error | null;
  sendMessage: (message: any) => void;
}

export const useWebSocket = (url: string = 'ws://localhost:8080'): WebSocketHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = (event) => {
        setError(new Error('WebSocket connection error'));
        setIsConnected(false);
      };

      setSocket(ws);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create WebSocket connection'));
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
    }
  }, [socket, isConnected]);

  return {
    isConnected,
    error,
    sendMessage
  };
}; 