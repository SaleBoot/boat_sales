package cmd

import (
	"errors"
	"fmt"
	"go0base/utils"
	"os"

	"github.com/spf13/cobra"
)

const (
	// Version go0base version info
	Version = "0.1.0"
)

type App struct {
	rootCmd *cobra.Command
}

func NewApp() *App {
	app := &App{
		rootCmd: &cobra.Command{
			Use:          "boatsales-backend",
			Short:        "boatsales-backend",
			SilenceUsage: true,
			Long:         `boatsales-backend`,
			Args: func(cmd *cobra.Command, args []string) error {
				if len(args) < 1 {
					tip()
					return errors.New(utils.Red("requires at least one arg"))
				}
				return nil
			},
			PersistentPreRunE: func(*cobra.Command, []string) error { return nil },
			Run: func(cmd *cobra.Command, args []string) {
				tip()
			},
		},
	}

	// 添加子命令
	var ginCmd = newGinCommand()
	app.rootCmd.AddCommand(ginCmd.cmd)

	var prj05 = newPrj05Command()
	app.rootCmd.AddCommand(prj05.cmd)

	return app
}

func tip() {
	usageStr := `欢迎使用 ` + utils.Green(`go0base `+Version) + ` 可以使用 ` + utils.Red(`-h`) + ` 查看命令`
	usageStr1 := `也可以参考 https://doc.xxxxxxx.dev/guide/ksks 的相关内容`
	fmt.Printf("%s\n", usageStr)
	fmt.Printf("%s\n", usageStr1)
}

func (a *App) Execute() {
	if err := a.rootCmd.Execute(); err != nil {
		os.Exit(-1)
	}
}
