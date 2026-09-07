package ws

import (
	"net/http"

	"boatsales-backend/internal/services/wshub"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// 生产环境建议替换为你的域名
		return true
	},
}

// ServeWs 处理WebSocket连接请求
func ServeWs(hub *wshub.WsHub, c *gin.Context) {
	// 升级HTTP为WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "websocket upgrade failed"})
		return
	}

	// 创建客户端
	client := &wshub.WsClient{
		Conn:   conn,
		ChSend: make(chan []byte, wshub.WriteChannelSize),
		Hub:    hub,
	}

	// 注册到hub
	hub.ChRegister <- client

	// 启动协程
	go client.WritePump()
	go client.ReadPump()
}
