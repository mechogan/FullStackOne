package setup

type DirectoriesStruct struct {
    Root string
	Config string
	NodeModules string
	Editor string
}

var Directories *DirectoriesStruct = nil

func SetupDirectories(root string, config string, nodeModules string, editor string) {
	Directories = &DirectoriesStruct{
		Root: root,
		Config: config,
		NodeModules: nodeModules,
		Editor: editor,
	}
}