package methods

import (
	"encoding/json"
	"path"

	archive "fullstacked/editor/src/archive"
	config "fullstacked/editor/src/config"
	"fullstacked/editor/src/connect"
	esbuild "fullstacked/editor/src/esbuild"
	fetch "fullstacked/editor/src/fetch"
	fs "fullstacked/editor/src/fs"
	git "fullstacked/editor/src/git"
	packages "fullstacked/editor/src/packages"
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

	FETCH  = 15
	FETCH2 = 16

	CONNECT = 20
	CONNECT_SEND = 21

	ARCHIVE_UNZIP_BIN_TO_FILE  = 30
	ARCHIVE_UNZIP_BIN_TO_BIN   = 31
	ARCHIVE_UNZIP_FILE_TO_FILE = 32
	ARCHIVE_UNZIP_FILE_TO_BIN  = 33

	ARCHIVE_ZIP_BIN_TO_FILE  = 34
	ARCHIVE_ZIP_BIN_TO_BIN   = 35
	ARCHIVE_ZIP_FILE_TO_FILE = 36
	ARCHIVE_ZIP_FILE_TO_BIN  = 37

	// EDITOR ONLY

	CONFIG_GET  = 50
	CONFIG_SAVE = 51

	ESBUILD_VERSION = 55
	ESBUILD_BUILD   = 56

	PACKAGE_INSTALL       = 60
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
	GIT_AUTH_RESPONSE = 81

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
	if isEditor {
		baseDir = setup.Directories.Root
	}

	switch {
	case method == HELLO:
		setup.Callback(projectId, "hello", "Hello From Go")
	case method == STATIC_FILE:
		if isEditor {
			baseDir = setup.Directories.Editor
		}
		return staticFiles.Serve(baseDir, args[0].(string))
	case method >= 2 && method <= 10:
		return fsSwitch(method, baseDir, args)
	case method == FETCH:
		headers := (map[string]string)(nil)
		if args[3].(string) != "" {
			_ = json.Unmarshal([]byte(args[3].(string)), &headers)
		}

		go fetch.FetchSerialized(
			projectId,
			args[0].(float64),
			args[1].(string),
			args[2].(string),
			&headers,
			args[4].([]byte),
			int(args[5].(float64)),
			args[6].(bool),
		)
	case method == FETCH2:
		headers := (map[string]string)(nil)
		if args[3].(string) != "" {
			_ = json.Unmarshal([]byte(args[3].(string)), &headers)
		}

		go fetch.Fetch2(
			projectId,
			args[0].(float64),
			args[1].(string),
			args[2].(string),
			&headers,
			args[4].([]byte),
		)
	case method == CONNECT:
		channelId := connect.Connect("test", 8888, "localhost")
		return serialize.SerializeString(channelId);
	case method == CONNECT_SEND:
		connect.Send(args[0].(string), serialize.SerializeString("ping"));
		return nil
	case method >= 30 && method <= 37:
		return archiveSwitch(isEditor, method, baseDir, args)
	case method >= 50:
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
		fileEventOrigin := ""
		if len(args) > 2 {
			fileEventOrigin = args[2].(string)
		}
		return fs.WriteFileSerialized(filePath, args[1].([]byte), fileEventOrigin)
	case FS_UNLINK:
		fileEventOrigin := ""
		if len(args) > 1 {
			fileEventOrigin = args[1].(string)
		}
		return fs.UnlinkSerialized(filePath, fileEventOrigin)
	case FS_READDIR:
		skip := []string{}
		if len(args) > 2 {
			for i, arg := range args {
				if i < 3 {
					continue
				}
				skip = append(skip, arg.(string))
			}
		}
		return fs.ReadDirSerialized(filePath, args[1].(bool), args[2].(bool), skip)
	case FS_MKDIR:
		fileEventOrigin := ""
		if len(args) > 1 {
			fileEventOrigin = args[1].(string)
		}
		return fs.MkdirSerialized(filePath, fileEventOrigin)
	case FS_RMDIR:
		fileEventOrigin := ""
		if len(args) > 1 {
			fileEventOrigin = args[1].(string)
		}
		return fs.RmdirSerialized(filePath, fileEventOrigin)
	case FS_EXISTS:
		return fs.ExistsSerialized(filePath)
	case FS_RENAME:
		fileEventOrigin := ""
		if len(args) > 2 {
			fileEventOrigin = args[2].(string)
		}
		newPath := path.Join(baseDir, args[1].(string))
		return fs.RenameSerialized(filePath, newPath, fileEventOrigin)
	case FS_STAT:
		return fs.StatSerialized(filePath)
	}

	return nil
}

func editorSwitch(method int, args []any) []byte {

	switch {
	case method == CONFIG_GET:
		return config.GetSerialized(args[0].(string))
	case method == CONFIG_SAVE:
		return config.SaveSerialized(args[0].(string), args[1].(string))
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
			if i < 3 {
				continue
			}
			packagesToInstall = append(packagesToInstall, p.(string))
		}
		go packages.Install(installationId, projectDirectory, args[2].(bool), packagesToInstall)
	case method == PACKAGE_INSTALL_QUICK:
		projectDirectory := setup.Directories.Root + "/" + args[0].(string)
		installationId := args[1].(float64)
		go packages.InstallQuick(installationId, projectDirectory)
	case method == OPEN:
		setup.Callback("", "open", args[0].(string))
		return nil
	case method >= 70 && method <= 81:
		return gitSwitch(method, args)
	}

	return nil
}

func gitSwitch(method int, args []any) []byte {
	directory := path.Join(setup.Directories.Root, args[0].(string))

	switch method {
	case GIT_CLONE:
		go git.Clone(directory, args[1].(string))
	case GIT_HEAD:
		return git.Head(directory)
	case GIT_STATUS:
		return git.Status(directory)
	case GIT_PULL:
		go git.Pull(directory)
	case GIT_PUSH:
		go git.Push(directory)
	case GIT_RESTORE:
		files := []string{}
		for _, file := range args[1:] {
			files = append(files, file.(string))
		}
		return git.Restore(directory, files)
	case GIT_CHECKOUT:
		return git.Checkout(directory, args[1].(string), args[2].(bool))
	case GIT_FETCH:
		return git.Fetch(directory)
	case GIT_COMMIT:
		return git.Commit(directory, args[1].(string), args[2].(string), args[3].(string))
	case GIT_BRANCHES:
		return git.Branches(directory)
	case GIT_BRANCH_DELETE:
		return git.BranchDelete(directory, args[1].(string))
	case GIT_AUTH_RESPONSE:
		git.AuthResponse(args[0].(string), args[1].(bool))
	}

	return nil
}

func archiveSwitch(isEditor bool, method int, baseDir string, args []any) []byte {
	switch method {
	case ARCHIVE_UNZIP_BIN_TO_FILE:
		entry := args[0].([]byte)
		out := path.Join(baseDir, args[1].(string))

		// Android and WASM uses this to unzip
		if len(args) > 2 && isEditor && args[2].(bool) {
			out = args[1].(string)
		}

		return archive.UnzipDataToFilesSerialized(entry, out)
	case ARCHIVE_UNZIP_BIN_TO_BIN:
		entry := args[0].([]byte)
		return archive.UnzipDataToDataSerialized(entry)
	case ARCHIVE_UNZIP_FILE_TO_FILE:
		entry := path.Join(baseDir, args[0].(string))
		out := path.Join(baseDir, args[1].(string))
		return archive.UnzipFileToFilesSerialized(entry, out)
	case ARCHIVE_UNZIP_FILE_TO_BIN:
		entry := args[0].(string)
		return archive.UnzipFileToDataSerialized(entry)
	case ARCHIVE_ZIP_BIN_TO_FILE:
		out := path.Join(baseDir, args[0].(string))
		entries := archive.SerializedArgsToFileEntries(args[1:])
		return archive.ZipDataToFileSerialized(entries, out)
	case ARCHIVE_ZIP_BIN_TO_BIN:
		entries := archive.SerializedArgsToFileEntries(args)
		return archive.ZipDataToDataSerialized(entries)
	case ARCHIVE_ZIP_FILE_TO_FILE:
		entry := path.Join(baseDir, args[0].(string))
		out := path.Join(baseDir, args[1].(string))
		skip := []string{}
		if len(args) > 2 {
			for i := 2; i < len(args); i++ {
				skip = append(skip, args[i].(string))
			}
		}
		return archive.ZipFileToFileSerialized(entry, out, skip)
	case ARCHIVE_ZIP_FILE_TO_BIN:
		entry := path.Join(baseDir, args[0].(string))
		skip := []string{}
		if len(args) > 1 {
			for i := 1; i < len(args); i++ {
				skip = append(skip, args[i].(string))
			}
		}
		return archive.ZipFileToDataSerialized(entry, skip)
	}

	return nil
}
