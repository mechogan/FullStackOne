package setup

import (
	"path"
)

type DirectoriesStruct struct {
	Root        string
	Config      string
	Tmp         string
	Editor      string
}

var Directories *DirectoriesStruct = nil

func SetupDirectories(root string, config string, editor string) {
	Directories = &DirectoriesStruct{
		Root:        root,
		Config:      config,
		Tmp:         path.Join(root, ".tmp"),
		Editor:      editor,
	}
}
