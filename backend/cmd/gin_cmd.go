package cmd

import (
	"fmt"
	"log"
	"os"
	"os/signal"

	"github.com/spf13/cobra"

	"go0base/fw-gin-test/config"
	"go0base/utils"
)

type tGinCommand struct {
	cmd *cobra.Command

	configYml string
	apiCheck  bool

	appRouters []func()
}

func newGinCommand() *tGinCommand {
	ret := &tGinCommand{
		configYml: "config/settings.yml",
		apiCheck:  false,
	}

	ret.cmd = &cobra.Command{
		Use:          "server",
		Short:        "Start Gin API server",
		Example:      "go0base server -c config/settings.yml",
		SilenceUsage: true,
		PreRun: func(cmd *cobra.Command, args []string) {
			ret.setup()
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return ret.run()
		},
	}

	ret.init()

	return ret
}

func (g *tGinCommand) init() {
	g.cmd.PersistentFlags().StringVarP(&(g.configYml), "config", "c", "config/settings.yml",
		"Start server with provided configuration file")
	g.cmd.PersistentFlags().BoolVarP(&(g.apiCheck), "api", "a", false,
		"Start server with check api data")

	// //注册路由 fixme 其他应用的路由，在本目录新建文件放在init方法
	// g.appRouters = make([]func(), 0)
	// g.appRouters = append(g.appRouters, router.InitRouter)
}

func (g *tGinCommand) setup() {
	// // 注入配置扩展项
	// config.ExtendConfig = &ext.ExtConfig
	// //1. 读取配置
	// config.Setup(
	// 	file.NewSource(file.WithPath(configYml)),
	// 	database.Setup,
	// 	storage.Setup,
	// )
	// //注册监听函数
	// queue := sdk.Runtime.GetMemoryQueue("")
	// queue.Register(global.LoginLog, models.SaveLoginLog)
	// queue.Register(global.OperateLog, models.SaveOperaLog)
	// queue.Register(global.ApiCheck, models.SaveSysApi)
	// go queue.Run()

	usageStr := `starting api server...`
	log.Println(usageStr)
}

func (g *tGinCommand) run() error {
	// if config.ApplicationConfig.Mode == pkg.ModeProd.String() {
	// 	gin.SetMode(gin.ReleaseMode)
	// }
	initRouter()

	for _, f := range g.appRouters {
		f()
	}

	// srv := &http.Server{
	// 	Addr:    fmt.Sprintf("%s:%d", config.GinConfig.Host, config.GinConfig.Port),
	// 	Handler: sdk.Runtime.GetEngine(),
	// }

	// go func() {
	// 	jobs.InitJob()
	// 	jobs.Setup(sdk.Runtime.GetDb())

	// }()

	// if apiCheck {
	// 	var routers = sdk.Runtime.GetRouter()
	// 	q := sdk.Runtime.GetMemoryQueue("")
	// 	mp := make(map[string]interface{})
	// 	mp["List"] = routers
	// 	message, err := sdk.Runtime.GetStreamMessage("", global.ApiCheck, mp)
	// 	if err != nil {
	// 		log.Infof("GetStreamMessage error, %s \n", err.Error())
	// 		//日志报错错误，不中断请求
	// 	} else {
	// 		err = q.Append(message)
	// 		if err != nil {
	// 			log.Infof("Append message error, %s \n", err.Error())
	// 		}
	// 	}
	// }

	// go func() {
	// 	// 服务连接
	// 	if config.SslConfig.Enable {
	// 		if err := srv.ListenAndServeTLS(config.SslConfig.Pem, config.SslConfig.KeyStr); err != nil && !errors.Is(err, http.ErrServerClosed) {
	// 			log.Fatal("listen: ", err)
	// 		}
	// 	} else {
	// 		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
	// 			log.Fatal("listen: ", err)
	// 		}
	// 	}
	// }()
	// fmt.Println(pkg.Red(string(global.LogoContent)))

	ginCmdTip()
	fmt.Println(utils.Green("Server run at:"))
	fmt.Printf("-  Local:   %s://localhost:%d/ \r\n", "http", config.GinConfig.Port)
	fmt.Printf("-  Network: %s://%s:%d/ \r\n", "http", utils.GetLocalHost(), config.GinConfig.Port)
	fmt.Println(utils.Green("Swagger run at:"))
	fmt.Printf("-  Local:   http://localhost:%d/swagger/admin/index.html \r\n", config.GinConfig.Port)
	fmt.Printf("-  Network: %s://%s:%d/swagger/admin/index.html \r\n", "http", utils.GetLocalHost(), config.GinConfig.Port)
	fmt.Printf("%s Enter Control + C Shutdown Server \r\n", utils.GetCurrentTimeStr())
	// 等待中断信号以优雅地关闭服务器（设置 5 秒的超时时间）
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	// ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	// defer cancel()
	// log.Info("Shutdown Server ... ")

	// if err := srv.Shutdown(ctx); err != nil {
	// 	log.Fatal("Server Shutdown:", err)
	// }
	log.Println("Server exiting")

	return nil
}

//var Router runtime.Router

func ginCmdTip() {
	usageStr := `欢迎使用 ` + utils.Green(`go-admin `+Version) + ` 可以使用 ` + utils.Red(`-h`) + ` 查看命令`
	fmt.Printf("%s \n\n", usageStr)
}

func initRouter() {
	// var r *gin.Engine
	// h := sdk.Runtime.GetEngine()
	// if h == nil {
	// 	h = gin.New()
	// 	sdk.Runtime.SetEngine(h)
	// }
	// switch h.(type) {
	// case *gin.Engine:
	// 	r = h.(*gin.Engine)
	// default:
	// 	log.Fatal("not support other engine")
	// 	//os.Exit(-1)
	// }
	// if config.SslConfig.Enable {
	// 	r.Use(handler.TlsHandler())
	// }
	// //r.Use(middleware.Metrics())
	// r.Use(common.Sentinel()).
	// 	Use(common.RequestId(utils.TrafficKey)).
	// 	Use(api.SetRequestLogger)

	// common.InitMiddleware(r)

}
