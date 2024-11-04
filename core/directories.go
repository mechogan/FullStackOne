package main

type Directories struct {
    root string
	config string
	nodeModules string
	editor string
}


var directories *Directories = nil

func SetupDirectories(root string, config string, nodeModules string, editor string) {
	directories = &Directories{
		root: root,
		config: config,
		nodeModules: nodeModules,
		editor: editor,
	}
}