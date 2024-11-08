package fs

import (
	serialize "fullstacked/editor/src/serialize"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

var WASM = false

func ReadFile(path string) ([]byte, error) {
	fileData := ([]byte)(nil)
	err := (error)(nil)

	if(WASM) {
		fileData, err = vReadFile(path)
	} else {
		fileData, err = os.ReadFile(path)
	}

	if err != nil {
		return nil, err
	}

	return fileData, nil
}

func ReadFileSerialized(path string, asString bool) []byte {
	fileData, err := ReadFile(path)

	if(err != nil) {
		return nil
	}

	if asString {
		return serialize.SerializeString(string(fileData))
	}

	return serialize.SerializeBuffer(fileData)
}

func WriteFile(path string, data []byte) error {
	err := (error)(nil)

	if(WASM) {
		err = vWriteFile(path, data)
	} else {
		err = os.WriteFile(path, data, 0644)
	}

	return err
}

func WriteFileSerialized(path string, data []byte) []byte {
	err := WriteFile(path, data)
	return serialize.SerializeBoolean(err != nil)
}


func ReadDirSerialized(path string, recursive bool, withFileTypes bool) []byte {
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

func MkDir(path string) bool {
	err := (error)(nil)

	if(WASM) {
		err = vMkDir(path)
	} else {
		err = os.MkdirAll(path, 0755)
	}
	
	return err == nil
}

func MkDirSerialized(path string) []byte {
	return serialize.SerializeBoolean(MkDir(path))
}

type SmallFileInfo struct {
	Name string 
	Size int64 
	ModTime time.Time 
	IsDir bool 
}


func Stat(path string) (*SmallFileInfo, error) {
	if(WASM) {
		return vStat(path)
	} 
	
	fileInfo, err := os.Stat(path);

	if(err != nil) {
		return nil, err
	}

	return &SmallFileInfo{
		fileInfo.Name(),
		fileInfo.Size(),
		fileInfo.ModTime(),
		fileInfo.IsDir(),
	}, nil
}

func StatSerialized(path string) {

}