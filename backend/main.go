package main

import (
	"boatsales-backend/cmd"
	"math/rand"
	"time"
)

func main() {
	// 以当前时间的纳秒数（time.Now().UnixNano()）作为种子，初始化全局伪随机数生成器。
	// 为什么要写：后续代码中出现了 /api/scene/random（随机场景），这个初始化确保了程序每次启动时，
	// 产生的随机数序列都是不同的，避免每次重启后抽到相同的“随机”结果。
	// (注：在较新的 Go 版本中这行可以省略，但在旧版本或为了兼容性，这行很常见)。
	rand.Seed(time.Now().UnixNano())

	app := cmd.NewApp()
	app.Execute()
}
