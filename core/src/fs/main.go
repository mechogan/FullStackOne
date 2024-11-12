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

	if WASM {
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

	if err != nil {
		return nil
	}

	if asString {
		return serialize.SerializeString(string(fileData))
	}

	return serialize.SerializeBuffer(fileData)
}

func WriteFile(path string, data []byte) error {
	err := (error)(nil)

	if WASM {
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

func Unlink(path string) bool {
	err := (error)(nil)

	if WASM {
		err = vUnlink(path)
	} else {
		err = os.Remove(path)
	}

	return err == nil
}

func UnlinkSerialized(path string) []byte {
	return serialize.SerializeBoolean(Unlink(path))
}

func ReadDir(path string, recursive bool) ([]SmallFileInfo, error) {
	items := []SmallFileInfo{}

	if WASM {
		items = vReadDir(path, recursive)
	} else {

		if recursive {
			err := filepath.WalkDir(path, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}

				items = append(items, SmallFileInfo{
					Name:  path,
					IsDir: d.IsDir(),
				})

				return nil
			})

			if err != nil {
				return nil, err
			}
		} else {

			entries, err := os.ReadDir(path)

			if err != nil {
				return nil, err
			}

			for _, item := range entries {
				items = append(items, SmallFileInfo{
					Name:  item.Name(),
					IsDir: item.IsDir(),
				})
			}
		}
	}

	return items, nil
}

func ReadDirSerialized(path string, recursive bool, withFileTypes bool) []byte {
	items := ([]SmallFileInfo)(nil)
	err := (error)(nil)

	if WASM {
		items = vReadDir(path, recursive)
	} else {
		items, err = ReadDir(path, recursive)

		if err != nil {
			return nil
		}
	}

	bytes := []byte{}
	for _, item := range items {

		bytes = append(bytes, serialize.SerializeString(item.Name)...)

		if withFileTypes {
			bytes = append(bytes, serialize.SerializeBoolean(item.IsDir)...)
		}
	}

	return bytes
}

func Mkdir(path string) bool {
	err := (error)(nil)

	if WASM {
		err = vMkdir(path)
	} else {
		err = os.MkdirAll(path, 0755)
	}

	return err == nil
}

func MkdirSerialized(path string) []byte {
	return serialize.SerializeBoolean(Mkdir(path))
}

func Rmdir(path string) bool {
	err := (error)(nil)

	if WASM {
		err = vRmdir(path)
	} else {
		err = os.RemoveAll(path)
	}

	return err == nil
}

func RmdirSerialized(path string) []byte {
	return serialize.SerializeBoolean(Rmdir(path))
}

func Exists(path string) (bool, bool) {
	exists := false
	isFile := false

	if WASM {
		exists, isFile = vExists(path)
	} else {
		stat, err := os.Stat(path)
		if err == nil {
			exists = true
			isFile = !stat.IsDir()
		}
	}

	return exists, isFile
}

func ExistsSerialized(path string) []byte {
	bytes := []byte{}
	exists, isFile := Exists(path)
	bytes = append(bytes, serialize.SerializeBoolean(exists)...)
	bytes = append(bytes, serialize.SerializeBoolean(isFile)...)
	return bytes
}

type SmallFileInfo struct {
	Name    string
	Size    int64
	ModTime time.Time
	IsDir   bool
}

func Stat(path string) *SmallFileInfo {
	if WASM {
		return vStat(path)
	}

	fileInfo, err := os.Stat(path)

	if err != nil {
		return nil
	}

	return &SmallFileInfo{
		fileInfo.Name(),
		fileInfo.Size(),
		fileInfo.ModTime(),
		fileInfo.IsDir(),
	}
}

func StatSerialized(path string) []byte {
	stats := Stat(path)

	if stats == nil {
		return nil
	}

	bytes := []byte{}

	bytes = append(bytes, serialize.SerializeString(stats.Name)...)
	bytes = append(bytes, serialize.SerializeNumber(int(stats.Size))...)
	bytes = append(bytes, serialize.SerializeNumber(int(stats.ModTime.UnixMilli()))...)
	bytes = append(bytes, serialize.SerializeBoolean(stats.IsDir)...)

	return bytes
}

func Rename(oldPath string, newPath string) bool {
	err := (error)(nil)

	if WASM {
		err = vRename(oldPath, newPath)
	} else {
		err = os.Rename(oldPath, newPath)
	}

	return err == nil
}

func RenameSerialized(oldPath string, newPath string) []byte {
	return serialize.SerializeBoolean(Rename(oldPath, newPath))
}
