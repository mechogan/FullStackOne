package methods

import (
	"path"

	archive "fullstacked/editor/src/archive"
	esbuild "fullstacked/editor/src/esbuild"
	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	staticFiles "fullstacked/editor/src/staticFiles"
)

const (
	UNKNOWN     = 0
	STATIC_FILE = 1

	FS_READFILE  = 2
	FS_WRITEFILE = 3
	FS_UNLINK    = 4
	FS_READDIR   = 5
	FS_MKDIR     = 6
	FS_RMDIR     = 7
	FS_EXISTS    = 8
	FS_RENAME    = 9
	FS_STAT      = 10

	FETCH     = 15
	BROADCAST = 20

	// EDITOR ONLY

	ARCHIVE_UNZIP = 30

	CONFIG_GET  = 50
	CONFIG_SAVE = 51

	ESBUILD_VERSION = 55
	ESBUILD_BUILD   = 56
)

func Call(payload []byte) []byte {
	cursor := 0
	isEditor := payload[cursor] == 1
	cursor++
	projectIdLength := serialize.DeserializeBytesToNumber(payload[cursor : cursor+4])
	cursor += 4
	projectId := string(payload[cursor : cursor+projectIdLength])
	cursor += projectIdLength
	method, args := serialize.DeserializeArgs(payload[cursor:])

	baseDir := setup.Directories.Root + "/" + projectId

	switch {
	case method == STATIC_FILE:
		if isEditor {
			baseDir = setup.Directories.Editor
		}
		return staticFiles.Serve(baseDir, args[0].(string))
	case method >= 2 && method <= 9:
		if isEditor {
			baseDir = setup.Directories.Root
		}
		return fsSwitch(method, baseDir, args)
	case method > 20:
		if !isEditor {
			return nil
		}

		return editorSwitch(method, args)
	}

	return nil
}

func fsSwitch(method int, baseDir string, args []any) []byte {
	filePath := path.Join(baseDir, args[0].(string))

	switch method {
	case FS_READFILE:
		return fs.ReadFileSerialized(filePath, args[1].(bool))
	case FS_WRITEFILE:
		return fs.WriteFileSerialized(filePath, args[1].([]byte))
	case FS_UNLINK:
		return fs.UnlinkSerialized(filePath)
	case FS_READDIR:
		return fs.ReadDirSerialized(filePath, args[1].(bool), args[2].(bool))
	case FS_MKDIR:
		return fs.MkdirSerialized(filePath)
	case FS_RMDIR:
		return fs.RmdirSerialized(filePath)
	case FS_EXISTS:
		return fs.ExistsSerialized(filePath)
	case FS_RENAME:
		newPath := path.Join(baseDir, args[1].(string))
		return fs.RenameSerialized(filePath, newPath)
	case FS_STAT:
		return fs.StatSerialized(filePath)
	}

	return nil
}

func editorSwitch(method int, args []any) []byte {

	switch method {
	case CONFIG_GET:
		return setup.ConfigGet(args[0].(string))
	case CONFIG_SAVE:
		return setup.ConfigSave(args[0].(string), args[1].(string))
	case ESBUILD_VERSION:
		return serialize.SerializeString(esbuild.Version())
	case ARCHIVE_UNZIP:
		destination := path.Join(setup.Directories.Root, args[0].(string))

		// the unzip methood is useful for Android and WASM
		// allow to unzip out of the root dir
		if len(args) > 2 && args[2].(bool) {
			destination = args[0].(string)
		}

		return serialize.SerializeBoolean(archive.Unzip(destination, args[1].([]byte)))
	}

	return nil
}
