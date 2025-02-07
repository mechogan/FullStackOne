package methods

import (
	"encoding/json"
	"path"

	archive "fullstacked/editor/src/archive"
	config "fullstacked/editor/src/config"
	esbuild "fullstacked/editor/src/esbuild"
	fetch "fullstacked/editor/src/fetch"
	fs "fullstacked/editor/src/fs"
	git "fullstacked/editor/src/git"
	"fullstacked/editor/src/packages"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	staticFiles "fullstacked/editor/src/staticFiles"
)

const (
	HELLO       = 0
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
	ARCHIVE_ZIP   = 31

	CONFIG_GET  = 50
	CONFIG_SAVE = 51

	ESBUILD_VERSION = 55
	ESBUILD_BUILD   = 56

	PACKAGE_INSTALL = 60
	PACKAGE_INSTALL_QUICK = 61

	GIT_CLONE         = 70
	GIT_HEAD          = 71
	GIT_STATUS        = 72
	GIT_PULL          = 73
	GIT_RESTORE       = 74
	GIT_CHECKOUT      = 75
	GIT_FETCH         = 76
	GIT_COMMIT        = 77
	GIT_BRANCHES      = 78
	GIT_PUSH          = 79
	GIT_BRANCH_DELETE = 80

	OPEN = 100
)

func Call(payload []byte) []byte {
	cursor := 0
	isEditor := payload[cursor] == 1
	cursor++
	projectIdLength := serialize.DeserializeBytesToInt(payload[cursor : cursor+4])
	cursor += 4
	projectId := string(payload[cursor : cursor+projectIdLength])
	cursor += projectIdLength
	method, args := serialize.DeserializeArgs(payload[cursor:])

	baseDir := setup.Directories.Root + "/" + projectId

	switch {
	case method == HELLO:
		setup.Callback(projectId, "hello", "Hello From Go")
	case method == STATIC_FILE:
		if isEditor {
			baseDir = setup.Directories.Editor
		}
		return staticFiles.Serve(baseDir, args[0].(string))
	case method >= 2 && method <= 10:
		if isEditor {
			baseDir = setup.Directories.Root
		}
		return fsSwitch(method, baseDir, args)
	case method == FETCH:
		headers := (map[string]string)(nil)
		if args[3].(string) != "" {
			_ = json.Unmarshal([]byte(args[3].(string)), &headers)
		}

		go fetch.FetchSerialized(
			projectId,
			int(args[0].(float64)),
			args[1].(string),
			args[2].(string),
			&headers,
			args[4].([]byte),
			int(args[5].(float64)),
			args[6].(bool),
		)
	case method > 20:
		if !isEditor {
			return nil
		}

		return editorSwitch(method, args)
	}

	return nil
}

func fsSwitch(method int, baseDir string, args []any) []byte {
	fileName := ""
	if args[0] != nil {
		fileName = args[0].(string)
	}

	filePath := path.Join(baseDir, fileName)

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

	switch {
	case method == CONFIG_GET:
		return config.Get(args[0].(string))
	case method == CONFIG_SAVE:
		return config.Save(args[0].(string), args[1].(string))
	case method == ESBUILD_VERSION:
		return serialize.SerializeString(esbuild.Version())
	case method == ESBUILD_BUILD:
		projectDirectory := setup.Directories.Root + "/" + args[0].(string)
		go esbuild.Build(projectDirectory, args[1].(float64))
	case method == PACKAGE_INSTALL:
		projectDirectory := setup.Directories.Root + "/" + args[0].(string)
		installationId := args[1].(float64)
		packagesToInstall := []string{}
		for i, p := range args {
			if i < 2 {
				continue
			}
			packagesToInstall = append(packagesToInstall, p.(string))
		}
		go packages.Install(installationId, projectDirectory, packagesToInstall)
	case method == PACKAGE_INSTALL_QUICK:
		projectDirectory := setup.Directories.Root + "/" + args[0].(string)
		installationId := args[1].(float64)
		go packages.InstallQuick(installationId, projectDirectory)
	case method == ARCHIVE_UNZIP:
		destination := path.Join(setup.Directories.Root, args[0].(string))

		// the unzip methood is useful for Android and WASM
		// allow to unzip out of the root dir
		if len(args) > 2 && args[2].(bool) {
			destination = args[0].(string)
		}

		return serialize.SerializeBoolean(archive.Unzip(destination, args[1].([]byte)))
	case method == ARCHIVE_ZIP:
		directory := path.Join(setup.Directories.Root, args[0].(string))
		return serialize.SerializeBuffer(archive.Zip(directory))
	case method == OPEN:
		setup.Callback("", "open", args[0].(string))
		return nil
	case method >= 70 && method <= 80:
		return gitSwitch(method, args)
	}

	return nil
}

func gitSwitch(method int, args []any) []byte {
	directory := path.Join(setup.Directories.Root, args[0].(string))

	switch method {
	case GIT_CLONE:
		if len(args) > 2 && args[2] != nil && args[3] != nil {
			username := args[2].(string)
			password := args[3].(string)
			go git.Clone(directory, args[1].(string), &username, &password)
		} else {
			go git.Clone(directory, args[1].(string), nil, nil)
		}
	case GIT_HEAD:
		return git.Head(directory)
	case GIT_STATUS:
		return git.Status(directory)
	case GIT_PULL:
		if len(args) > 1 && args[1] != nil && args[2] != nil {
			username := args[1].(string)
			password := args[2].(string)
			go git.Pull(directory, &username, &password)
		} else {
			go git.Pull(directory, nil, nil)
		}
	case GIT_PUSH:
		if len(args) > 1 && args[1] != nil && args[2] != nil {
			username := args[1].(string)
			password := args[2].(string)
			go git.Push(directory, &username, &password)
		} else {
			go git.Push(directory, nil, nil)
		}
	case GIT_RESTORE:
		files := []string{}
		for _, file := range args[1:] {
			files = append(files, file.(string))
		}
		return git.Restore(directory, files)
	case GIT_CHECKOUT:
		if len(args) > 3 && args[3] != nil && args[4] != nil {
			username := args[3].(string)
			password := args[4].(string)
			return git.Checkout(directory, args[1].(string), args[2].(bool), &username, &password)
		}

		return git.Checkout(directory, args[1].(string), args[2].(bool), nil, nil)
	case GIT_FETCH:
		if len(args) > 1 && args[1] != nil && args[2] != nil {
			username := args[1].(string)
			password := args[2].(string)
			return git.Fetch(directory, &username, &password)
		}

		return git.Fetch(directory, nil, nil)
	case GIT_COMMIT:
		return git.Commit(directory, args[1].(string), args[2].(string), args[3].(string))
	case GIT_BRANCHES:
		if len(args) > 1 && args[1] != nil && args[2] != nil {
			username := args[1].(string)
			password := args[2].(string)
			return git.Branches(directory, &username, &password)
		}

		return git.Branches(directory, nil, nil)
	case GIT_BRANCH_DELETE:
		return git.BranchDelete(directory, args[1].(string))
	}

	return nil
}
