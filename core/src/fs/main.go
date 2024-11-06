package fs

import (
	"fullstacked/editor/src/serialize"
	"io/fs"
	"os"
	"path/filepath"
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


func ReadDir(path string, recursive bool, withFileTypes bool) []byte {
	bytes := []byte{}

	if(recursive) {
		err := filepath.WalkDir(path, func(path string, d fs.DirEntry, err error) error {
			if(err != nil) {
				return err
			}

			bytes = append(bytes, serialize.SerializeString(path)...)

			if(withFileTypes) {
				bytes = append(bytes, serialize.SerializeBoolean(d.IsDir())...)
			}

			return nil
		})

		if(err != nil) {
			return nil
		}

		return bytes
	}

	items, err := os.ReadDir(path)

	if(err != nil) {
		return nil
	}

	for _, item  := range items {
		bytes = append(bytes, serialize.SerializeString(item.Name())...)

		if(withFileTypes) {
			bytes = append(bytes, serialize.SerializeBoolean(item.IsDir())...)
		}
	}

	return bytes;
}