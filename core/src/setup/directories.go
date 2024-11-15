package setup

import (
	"path"
)

type DirectoriesStruct struct {
	Root        string
	Config      string
	NodeModules string
	Tmp         string
	Editor      string
}

var Directories *DirectoriesStruct = nil

func SetupDirectories(root string, config string, editor string) {
	Directories = &DirectoriesStruct{
		Root:        root,
		Config:      config,
		NodeModules: path.Join(root, "node_modules"),
		Tmp:         path.Join(root, ".tmp"),
		Editor:      editor,
	}
}
