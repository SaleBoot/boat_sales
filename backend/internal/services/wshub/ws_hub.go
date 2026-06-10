package wshub

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// 心跳超时时间
	pongWait = 60 * time.Second
	// 发送心跳间隔（必须小于pongWait）
	pingPeriod = (pongWait * 9) / 10
	// 发送队列大小
	WriteChannelSize = 256
)

// WsClient WebSocket客户端实例
type WsClient struct {
	Conn   *websocket.Conn
	ChSend chan []byte
	Hub    *WsHub // 持有hub引用
}

// WsHub 管理所有客户端连接
type WsHub struct {
	ctx          context.Context
	mu           sync.RWMutex
	Clients      map[*WsClient]bool
	ChBroadcast  chan []byte
	ChRegister   chan *WsClient
	ChUnregister chan *WsClient
}

func NewHub(ctx context.Context) *WsHub {
	return &WsHub{
		ctx:          ctx,
		Clients:      make(map[*WsClient]bool),
		ChBroadcast:  make(chan []byte),
		ChRegister:   make(chan *WsClient),
		ChUnregister: make(chan *WsClient),
	}
}

// Run 启动hub主循环
func (h *WsHub) Run() {
	defer func() {
		h.mu.Lock()
		for client := range h.Clients {
			close(client.ChSend)
			_ = client.Conn.Close()
		}
		h.Clients = nil
		h.mu.Unlock()
		log.Println("✅ WebSocket Hub 已安全关闭")
	}()

	log.Println("✅ WebSocket Hub 启动成功")

	for {
		select {
		case <-h.ctx.Done():
			log.Println("🛑 收到关闭信号，正在关闭Hub...")
			return

		case client := <-h.ChRegister:
			h.mu.Lock()
			h.Clients[client] = true
			h.mu.Unlock()
			log.Printf("✅ 新客户端连接，当前在线：%d", len(h.Clients))

		case client := <-h.ChUnregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.ChSend)
			}
			h.mu.Unlock()
			log.Printf("✅ 客户端断开，当前在线：%d", len(h.Clients))

		case message := <-h.ChBroadcast:
			h.mu.RLock()
			for client := range h.Clients {
				select {
				case client.ChSend <- message:
				case <-time.After(10 * time.Millisecond):
					log.Println("⏱️ 发送超时，丢弃消息")
				}
			}
			h.mu.RUnlock()
		}
	}
}

// WritePump 写消息协程：负责发送消息 + 自动心跳
func (c *WsClient) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.ChSend:
			if !ok {
				// 通道关闭，发送关闭帧
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)
			_ = w.Close()

		case <-ticker.C:
			// 定时发送心跳ping
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump 读消息协程：负责接收消息 + 处理心跳
func (c *WsClient) ReadPump() {
	defer func() {
		c.Hub.ChUnregister <- c
		_ = c.Conn.Close()
	}()

	// 设置读超时（心跳机制）
	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// 循环读取客户端消息
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure) {
				log.Printf("读取错误: %v", err)
			}
			break
		}
		// 收到消息 → 广播给所有人
		c.Hub.ChBroadcast <- message
	}
}
