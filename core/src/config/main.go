package config

import (
	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	"path"
)

func Get(configFile string) []byte {
	filePath := path.Join(setup.Directories.Config, configFile+".json")

	config, err := fs.ReadFile(filePath)

	if err != nil {
		return nil
	}

	return serialize.SerializeString(string(config))
}

func Save(configFile string, data string) []byte {
	filePath := path.Join(setup.Directories.Config, configFile+".json")

	fs.Mkdir(path.Dir(filePath))

	err := fs.WriteFile(filePath, []byte(data))

	if err != nil {
		return serialize.SerializeBoolean(false)
	}

	return serialize.SerializeBoolean(true)
}
