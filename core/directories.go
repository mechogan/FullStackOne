package main

type DirectoriesStruct struct {
    root string
	config string
	nodeModules string
	editor string
}


var Directories *DirectoriesStruct = nil

func SetupDirectories(root string, config string, nodeModules string, editor string) {
	Directories = &DirectoriesStruct{
		root: root,
		config: config,
		nodeModules: nodeModules,
		editor: editor,
	}
}