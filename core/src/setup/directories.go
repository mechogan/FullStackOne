package setup

import (
	fs "fullstacked/editor/src/fs"
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

	fs.Mkdir(root)
	fs.Mkdir(config)
	fs.Mkdir(Directories.NodeModules)
	fs.Mkdir(Directories.Tmp)
	fs.Mkdir(editor)
}
