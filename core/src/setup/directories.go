package setup

type DirectoriesStruct struct {
	Root   string
	Config string
	Editor string
	Tmp    string
}

var Directories *DirectoriesStruct = nil

func SetupDirectories(
	root string,
	config string,
	editor string,
	tmp string,
) {
	Directories = &DirectoriesStruct{
		Root:   root,
		Config: config,
		Editor: editor,
		Tmp:    tmp,
	}
}
