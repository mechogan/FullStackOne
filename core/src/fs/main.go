package fs

import (
	"errors"
	serialize "fullstacked/editor/src/serialize"
	"github.com/djherbis/times"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var WASM = false

func ReadFile(path string) ([]byte, error) {
	fileData := ([]byte)(nil)
	err := (error)(nil)

	exists, isFile := Exists(path)

	if !exists {
		return nil, errors.New("ENOENT")
	}

	if !isFile {
		return nil, errors.New("EISDIR")
	}

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
		return serialize.SerializeError(err)
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
	if err == nil {
		return []byte{}
	}
	return serialize.SerializeString(err.Error())
}

func Unlink(path string) error {
	err := (error)(nil)

	if WASM {
		err = vUnlink(path)
	} else {
		err = os.Remove(path)
	}

	return err
}

func UnlinkSerialized(path string) []byte {
	err := Unlink(path)
	if err == nil {
		return []byte{}
	}
	return serialize.SerializeString(err.Error())
}

func containsStartWith(arr []string, e string) bool {
	for _, i := range arr {
		if(strings.HasPrefix(e, i)) {
			return true
		}
	}

	return false
}

func ReadDir(path string, recursive bool, skip []string) ([]FileInfo2, error) {
	items := []FileInfo2{}

	exists, isFile := Exists(path)
	if !exists {
		return nil, errors.New("ENOENT")
	}

	if isFile {
		return nil, errors.New("ENOTDIR")
	}

	if WASM {
		items = vReadDir(path, recursive, skip)
	} else {
		pathComponents := splitPath(filepath.ToSlash(path))

		if recursive {
			err := filepath.WalkDir(path, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}

				itemPathComponents := splitPath(filepath.ToSlash(path))

				relativeName := strings.Join(itemPathComponents[len(pathComponents):], "/")

				if(containsStartWith(skip, relativeName)) {
					return nil
				}

				items = append(items, FileInfo2{
					Name:  relativeName,
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
				items = append(items, FileInfo2{
					Name:  item.Name(),
					IsDir: item.IsDir(),
				})
			}
		}
	}

	return items, nil
}

func ReadDirSerialized(path string, recursive bool, withFileTypes bool, skip []string) []byte {
	items := ([]FileInfo2)(nil)
	err := (error)(nil)

	if WASM {
		items = vReadDir(path, recursive, skip)
	} else {
		items, err = ReadDir(path, recursive, skip)

		if err != nil {
			return serialize.SerializeError(err)
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

type FileInfo2 struct {
	Name  string
	Size  int64
	ATime time.Time
	MTime time.Time
	CTime time.Time
	IsDir bool
	Mode  os.FileMode
}

func Stat(path string) (*FileInfo2, error) {
	exists, _ := Exists(path)

	if !exists {
		return nil, errors.New("ENOENT")
	}

	if WASM {
		return vStat(path), nil
	}

	fileInfo, err := os.Stat(path)

	if err != nil {
		return nil, err
	}

	t, _ := times.Stat(path)

	mTime := t.ModTime()
	aTime := t.AccessTime()

	cTime := mTime
	if t.HasChangeTime() {
		cTime = t.ChangeTime()
	}

	return &FileInfo2{
		Name:  fileInfo.Name(),
		Size:  fileInfo.Size(),
		ATime: aTime,
		MTime: mTime,
		CTime: cTime,
		IsDir: fileInfo.IsDir(),
		Mode:  fileInfo.Mode(),
	}, nil
}

func StatSerialized(path string) []byte {
	stats, err := Stat(path)

	if err != nil {
		return serialize.SerializeError(err)
	}

	bytes := []byte{}

	bytes = append(bytes, serialize.SerializeString(stats.Name)...)
	bytes = append(bytes, serialize.SerializeNumber(float64(stats.Size))...)
	bytes = append(bytes, serialize.SerializeNumber(float64(stats.ATime.UnixMilli()))...)
	bytes = append(bytes, serialize.SerializeNumber(float64(stats.MTime.UnixMilli()))...)
	bytes = append(bytes, serialize.SerializeNumber(float64(stats.CTime.UnixMilli()))...)
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
