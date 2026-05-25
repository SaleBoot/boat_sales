package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"boatsales-backend/internal/migrate"
)

type tDbMigrateCommand struct {
	cmd *cobra.Command

	appName string
}

func newDbMigrateCommand() *tDbMigrateCommand {
	ret := &tDbMigrateCommand{
		appName: "dbMigrate",
	}

	ret.cmd = &cobra.Command{
		Use:     "dbMigrate",
		Short:   "start a dbMigrate app",
		Long:    "Use when you need to create a new dbMigrate app",
		Example: "boatsales-backend dbMigrate -n admin",
		Run: func(cmd *cobra.Command, args []string) {
			ret.run()
		},
	}

	return ret
}

func (g *tDbMigrateCommand) init() {
	fmt.Println(`tDbMigrateCommand.init()...start`)
	defer fmt.Println(`tDbMigrateCommand.init()...end`)

	// g.cmd.PersistentFlags().StringVarP(&(g.appName), "name", "n", "", "Start server with provided configuration file")
}

func (g *tDbMigrateCommand) run() {
	fmt.Println(`tDbMigrateCommand.run()...start`)
	defer fmt.Println(`tDbMigrateCommand.run()...end`)

	migrate.Main_migrate()
}
