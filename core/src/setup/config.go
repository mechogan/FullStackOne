package setup

import (
	"fullstacked/editor/src/serialize"
	"os"
	"path"
)

func ConfigGet(configFile string) []byte {
	filePath := path.Join(Directories.Config, configFile + ".json") 

	config, err := os.ReadFile(filePath)

	if(err != nil) {
		return nil
	}

	return serialize.SerializeString(string(config))
}

func ConfigSave(configFile string, data string) []byte {
	filePath := path.Join(Directories.Config, configFile + ".json")

	os.MkdirAll(path.Dir(filePath), 0755)

	err := os.WriteFile(filePath, []byte(data), 0644)

	if(err != nil) {
		return serialize.SerializeBoolean(false)
	}

	return serialize.SerializeBoolean(true)
}