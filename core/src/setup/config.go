package setup

import (
	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	"path"
)

func ConfigGet(configFile string) []byte {
	filePath := path.Join(Directories.Config, configFile + ".json") 

	config, err := fs.ReadFile(filePath)

	if(err != nil) {
		return nil
	}

	return serialize.SerializeString(string(config))
}

func ConfigSave(configFile string, data string) []byte {
	filePath := path.Join(Directories.Config, configFile + ".json")

	fs.Mkdir(path.Dir(filePath))

	err := fs.WriteFile(filePath, []byte(data))

	if(err != nil) {
		return serialize.SerializeBoolean(false)
	}

	return serialize.SerializeBoolean(true)
}