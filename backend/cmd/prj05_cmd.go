package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	producerconsumer "boatsales-backend/goprjs/05producer-consumer"
)

type tPrj05Command struct {
	cmd *cobra.Command

	appName string
}

func newPrj05Command() *tPrj05Command {
	ret := &tPrj05Command{
		appName: "go0base",
	}

	ret.cmd = &cobra.Command{
		Use:     "prj05",
		Short:   "start a prj05 app",
		Long:    "Use when you need to create a new prj05 app",
		Example: "go0base prj05 -n admin",
		Run: func(cmd *cobra.Command, args []string) {
			ret.run()
		},
	}

	return ret
}

func (g *tPrj05Command) init() {
	fmt.Println(`tPrj05Command.init()...start`)
	defer fmt.Println(`tPrj05Command.init()...end`)

	// g.cmd.PersistentFlags().StringVarP(&(g.appName), "name", "n", "", "Start server with provided configuration file")
}

func (g *tPrj05Command) run() {
	fmt.Println(`tPrj05Command.run()...start`)
	defer fmt.Println(`tPrj05Command.run()...end`)

	producerconsumer.Test_produ_comsum01()
}
