import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket 已连接');
      setIsConnected(true);
    };

    ws.current.onclose = () => {
      console.log('WebSocket 断开连接');
      setIsConnected(false);
      
      // 自动重连
      setTimeout(() => {
        if (ws.current?.readyState === WebSocket.CLOSED) {
          ws.current = new WebSocket(url);
        }
      }, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const sendMessage = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket 未连接');
    }
  }, []);

  return { sendMessage, isConnected };
};