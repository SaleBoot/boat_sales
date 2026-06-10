import { useEffect, useRef, useState, useCallback } from 'react';

function getWsUrl() {
  // 生产环境自动用当前域名
  // https://yourdomain.com → wss://yourdomain.com/api/ws
  // http://yourdomain.com  → ws://yourdomain.com/api/ws
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws`
}

export const WS_URL = getWsUrl()

export const useWebSocket = (url) => {
  const ws = useRef(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // 重连锁定
  const reconnecting = useRef(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    if (reconnecting.current) return;

    reconnecting.current = true;
    console.log("🔌 正在连接 WebSocket...");

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      console.log('✅ WebSocket 已连接');
      setIsWsConnected(true);
      reconnecting.current = false;
    };

    socket.onclose = (e) => {
      console.log(`❌ 断开: ${e.code} ${e.reason}`);
      setIsWsConnected(false);
      reconnecting.current = false;

      // 自动重连
      setTimeout(() => {
        if (socket.readyState === WebSocket.CLOSED) {
          connect();
        }
      }, 2000);
    };

    // ✅ 正确处理后端心跳（后端发 ping → 你必须返回 pong）
    socket.onmessage = (event) => {
      if (event.data === 'ping') {
        try {
          socket.send('pong');
        } catch {}
        return;
      }
      console.log('📨 收到:', event.data);
    };

    socket.onerror = (err) => {
      console.error('⚠️ WebSocket 错误:', err);
    };

  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        try {
          ws.current.close();
        } catch {}
      }
    };
  }, [connect]);

  const sendWsMessage = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(data));
      } catch (e) {
        console.warn("发送失败", e);
      }
    }
  }, []);

  return { sendWsMessage, isWsConnected };
};