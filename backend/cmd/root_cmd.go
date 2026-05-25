package cmd

import (
	"boatsales-backend/pkg/utils"
	"errors"
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
	app := &AppLv0{
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
	var ginCmd = newPrjV1Command()
	app.rootCmd.AddCommand(ginCmd.cmd)

	var dbMigrateCmd = newDbMigrateCommand()
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
