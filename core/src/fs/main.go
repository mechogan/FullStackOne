package fs

import (
	"fullstacked/editor/src/serialize"
	"os"
)

func ReadFile(path string, asString bool) []byte {
	fileData, err := os.ReadFile(path)

	if err != nil {
		return nil
	}

	if asString {
		return serialize.SerializeString(string(fileData))
	}

	return serialize.SerializeBuffer(fileData)
}

func WriteFile(path string, data []byte) []byte {
	err := os.WriteFile(path, data, 0644)

	if(err != nil) {
		return serialize.SerializeBoolean(false)
	}

	return serialize.SerializeBoolean(true)
}
