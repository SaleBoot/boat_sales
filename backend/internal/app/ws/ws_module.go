package ws

import (
	"boatsales-backend/internal/services/wshub"
	"context"

	"github.com/gin-gonic/gin"
)

type WsModule struct {
	// ws
	wsHub  *wshub.WsHub
	cancel context.CancelFunc
}

func NewWsModule() (*WsModule, error) {
	ctx, cancel := context.WithCancel(context.Background())
	wsHub := wshub.NewHub(ctx)

	return &WsModule{wsHub: wsHub, cancel: cancel}, nil
}

func (a *WsModule) RunWsHub() {
	go a.wsHub.Run()
}

func (a *WsModule) Stop() {
	if a.cancel != nil {
		a.cancel()
	}
}

func (a *WsModule) RegisterRoutes(rg *gin.RouterGroup) {

	rg.GET("/ws", func(c *gin.Context) {
		ServeWs(a.wsHub, c)
	})
}
