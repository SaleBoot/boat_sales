package cmd

import (
	"boatsales-backend/pkg/utils"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

const (
	// Version go0base version info
	Version = "0.1.0"
)

type AppLv0 struct {
	rootCmd *cobra.Command
}

func NewApp() *AppLv0 {
	// 添加子命令
	var ginCmd = newPrjV1Command()
	var dbMigrateCmd = newDbMigrateCommand()

	app := &AppLv0{
		rootCmd: &cobra.Command{
			Use:               "boatsales-backend",
			Short:             "boatsales-backend",
			SilenceUsage:      true,
			Long:              `boatsales-backend`,
			PersistentPreRunE: func(*cobra.Command, []string) error { return nil },
			Run: func(cmd *cobra.Command, args []string) {
				// 默认执行 ginCmd
				ginCmd.cmd.Run(ginCmd.cmd, args)
			},
		},
	}

	app.rootCmd.AddCommand(ginCmd.cmd)
	app.rootCmd.AddCommand(dbMigrateCmd.cmd)

	return app
}

func tip() {
	usageStr := `欢迎使用 ` + utils.Green(`boatsales-backend `+Version) + ` 可以使用 ` + utils.Red(`-h`) + ` 查看命令`
	fmt.Printf("%s\n", usageStr)
}

func (a *AppLv0) Execute() {
	if err := a.rootCmd.Execute(); err != nil {
		os.Exit(-1)
	}
}
