package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	v1 "boatsales-backend/v1"
)

type tPrjV1Command struct {
	cmd *cobra.Command

	appName string
}

func newPrjV1Command() *tPrjV1Command {
	ret := &tPrjV1Command{
		appName: "ginapp",
	}

	ret.cmd = &cobra.Command{
		Use:     "ginapp",
		Short:   "start a ginapp app",
		Long:    "Use when you need to create a new ginapp app",
		Example: "boatsales-backend ginapp -n admin",
		Run: func(cmd *cobra.Command, args []string) {
			ret.run()
		},
	}

	return ret
}

func (g *tPrjV1Command) init() {
	fmt.Println(`tPrjV1Command.init()...start`)
	defer fmt.Println(`tPrjV1Command.init()...end`)

	// g.cmd.PersistentFlags().StringVarP(&(g.appName), "name", "n", "", "Start server with provided configuration file")
}

func (g *tPrjV1Command) run() {
	fmt.Println(`tPrjV1Command.run()...start`)
	defer fmt.Println(`tPrjV1Command.run()...end`)

	v1.Main_v1()
}
