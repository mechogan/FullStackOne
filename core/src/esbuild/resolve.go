// https://nodejs.org/api/modules.html#all-together
package esbuild

import (
	"encoding/json"
	fs "fullstacked/editor/src/fs"
	setup "fullstacked/editor/src/setup"
	"path"
	"strings"

	esbuild "github.com/evanw/esbuild/pkg/api"
)

func vResolve(resolveDir string, module string, packageLock PackagesLock, rootPackageDependency bool) (*string, bool) {
	if strings.HasPrefix(module, "/") {
		panic("do not use absolute path for imports")
	}

	if strings.HasPrefix(module, ".") {
		modulePath := path.Clean(path.Join(resolveDir, module))
		resolvedPath := LOAD_AS_FILE(modulePath)
		if resolvedPath == nil {
			resolvedPath = LOAD_AS_DIR(modulePath)
		}
		if resolvedPath != nil {
			return resolvedPath, false
		}
	} else {
		exists := existResolve(module)
		if exists != nil {
			return exists, false
		}
	}

	// FullStacked lib modules
	resolvedPath := LOAD_FULLSTACKED_LIB_MODULE(module)
	if(resolvedPath != nil) {
		return resolvedPath, true
	}

	return LOAD_NODE_MODULES(module, packageLock, rootPackageDependency), false
}

var resolvingExtensions = []string{
	"", // if we have the extension in the modulePath
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".css",
}

func existResolve(filePath string) *string {
	for _, ext := range resolvingExtensions {
		filePathWithExt := filePath + ext
		exists, isFile := fs.Exists(filePathWithExt)
		if exists && isFile {
			return &filePathWithExt
		}
	}
	return nil
}

func LOAD_AS_FILE(modulePath string) *string {
	return existResolve(modulePath)
}

func LOAD_INDEX(dirPath string) *string {
	indexPath := path.Join(dirPath, "index")
	return existResolve(indexPath)
}

func LOAD_AS_DIR(modulePath string) *string {
	exists, isFile := fs.Exists(modulePath)
	if !exists || isFile {
		return nil
	}

	packageJsonPath := path.Join(modulePath, "package.json")
	pExsits, _ := fs.Exists(packageJsonPath)
	if pExsits {
		packageJsonData, _ := fs.ReadFile(packageJsonPath)
		packageJSON := PackageJSON{}
		err := json.Unmarshal(packageJsonData, &packageJSON)
		if err != nil || packageJSON.Main == "" {
			return LOAD_INDEX(modulePath)
		}

		mainPath := path.Join(modulePath, packageJSON.Main)

		mainResolved := LOAD_AS_FILE(mainPath)
		if mainResolved != nil {
			return mainResolved
		}
		mainResolved = LOAD_INDEX(mainPath)
		if mainResolved != nil {
			return mainResolved
		}
	}

	return LOAD_INDEX(modulePath)
}

func LOAD_FULLSTACKED_LIB_MODULE(module string) *string {
	libModulePath := path.Join(setup.Directories.Editor, "lib", module)
	resolvedPath := LOAD_AS_FILE(libModulePath)
	if resolvedPath != nil {
		return resolvedPath
	}

	return LOAD_AS_DIR(libModulePath)
}

func LOAD_NODE_MODULES(module string, packageLock PackagesLock, rootPackageDependency bool) *string {
	name, versionRequested, modulePath := ParseName(module)
	versionLocked, isLocked := packageLock[name]

	if(rootPackageDependency) {
		versionLocked, isLocked = packageLock[name + "@" + versionRequested]
	}

	if(!isLocked) {
		return nil
	}

	packageDirectory := path.Join(setup.Directories.NodeModules, name, versionLocked)
	resolvedPath := (*string)(nil)

	if(modulePath != "") {
		resolvedPath := LOAD_PACKAGE_EXPORTS(packageDirectory, modulePath)
		if resolvedPath != nil {
			return resolvedPath
		}
	}
	
	nodeModulePath := path.Join(packageDirectory, modulePath)
	resolvedPath = LOAD_AS_FILE(nodeModulePath)
	if resolvedPath != nil {
		return resolvedPath
	}

	return LOAD_AS_DIR(nodeModulePath)
}

func LOAD_PACKAGE_EXPORTS(packageDir string, modulePath string) *string {
	packageJsonPath := path.Join(packageDir, "package.json")
	exists, isFile := fs.Exists(packageJsonPath)
	if(!exists || !isFile) {
		return nil
	}

	packageJsonData, _ := fs.ReadFile(packageJsonPath)
	packageJSON := PackageJSON{}
	err := json.Unmarshal(packageJsonData, &packageJSON)

	if err != nil || packageJSON.Exports == nil {
		return nil
	}

	match := PACKAGE_EXPORTS_RESOLVE(packageDir, "."+modulePath, packageJSON.Exports)

	if match == nil {
		return nil
	}

	return existResolve(*match)
}

// https://github.com/nodejs/node/blob/main/doc/api/esm.md
func PACKAGE_EXPORTS_RESOLVE(moduleDirectory string, subpath string, exports json.RawMessage) *string {
	//  "exports": "./index.js"
	exportsString := ""

	//  "exports": ["./index.js", "./module.js"]
	exportsStringArray := []string{}

	// "exports": {
	//     ".": {
	//         "react-server": "./react.shared-subset.js",
	//         "default": "./index.js"
	//     },
	//     "./submodule.js": "./src/submodule.js"
	// }
	exportsObject := (map[string]json.RawMessage)(nil)

	match := (*string)(nil)
	err := json.Unmarshal(exports, &exportsString)
	if err == nil {
		match = PACKAGE_EXPORTS_RESOLVE_STRING(moduleDirectory, subpath, exportsString)
	}

	if match == nil {
		err = json.Unmarshal(exports, &exportsStringArray)
		if err == nil {
			match = PACKAGE_EXPORTS_RESOLVE_STRING_ARRAY(moduleDirectory, subpath, exportsStringArray)
		}
	}

	if match == nil {
		err = json.Unmarshal(exports, &exportsObject)
		if err == nil {
			match = PACKAGE_EXPORTS_RESOLVE_OBJECT(moduleDirectory, subpath, exportsObject)
		}
	}

	return match
}

// "exports": "./index.js"
func PACKAGE_EXPORTS_RESOLVE_STRING(moduleDirectory string, subpath string, exports string) *string {
	modulePath := path.Join(moduleDirectory, exports)
	return &modulePath
}

// "exports": ["./index.js", "./module.js"]
func PACKAGE_EXPORTS_RESOLVE_STRING_ARRAY(moduleDirectory string, subpath string, exports []string) *string {
	for _, export := range exports {
		if strings.HasPrefix(export, subpath) {
			modulePath := path.Join(moduleDirectory, export)
			return &modulePath
		}
	}

	return nil
}

func removeExtension(filePath string) string {
	filePathComponents := strings.Split(filePath, ".")
	if len(filePathComponents) > 1 {
		filePathComponents = filePathComponents[:len(filePathComponents)-1]
	}

	return strings.Join(filePathComponents, ".")
}

func arrayEquals(arrA []string, arrB []string) bool {
	if len(arrA) != len(arrB) {
		return false
	}

	for i, v := range arrA {
		if v != arrB[i] {
			return false
		}
	}

	return true
}

//	"exports": {
//	    ".": {
//	        "react-server": "./react.shared-subset.js",
//	        "default": "./index.js"
//	   },
//	   "./package.json": "./package.json",
//	   "./jsx-runtime": "./jsx-runtime.js",
//	   "./jsx-dev-runtime": "./jsx-dev-runtime.js"
//	}
func PACKAGE_EXPORTS_RESOLVE_OBJECT(moduleDirectory string, subpath string, exports map[string]json.RawMessage) *string {
	// no idea how to handle none-dot exports
	for key := range exports {
		if !strings.HasPrefix(key, ".") {
			return nil
		}
	}

	if subpath == "./" {
		subpath = "."
	}

	for key, export := range exports {
		if key == subpath {
			exportString := ""
			err := json.Unmarshal(export, &exportString)
			if err == nil {
				return PACKAGE_EXPORTS_RESOLVE_STRING(moduleDirectory, subpath, exportString)
			}

			exportStringArray := []string{}
			err = json.Unmarshal(export, &exportStringArray)
			if err == nil {
				return PACKAGE_EXPORTS_RESOLVE_STRING_ARRAY(moduleDirectory, subpath, exportStringArray)
			}

			exportObject := (map[string]string)(nil)
			err = json.Unmarshal(export, &exportObject)
			if err == nil {
				exportDefault := exportObject["default"]
				if exportDefault == "" {
					exportDefault = exportObject["import"]
				}
				return PACKAGE_EXPORTS_RESOLVE_STRING(moduleDirectory, subpath, exportDefault)
			}
		}

		if !strings.HasSuffix(key, "*") {
			continue
		}

		keyNoExt := removeExtension(key)
		keyNoExtComponents := strings.Split(keyNoExt, "/")

		subpathComponents := strings.Split(subpath, "/")

		if !arrayEquals(keyNoExtComponents[:len(keyNoExtComponents)-1], subpathComponents[:len(subpathComponents)-1]) {
			continue
		}

		matchString := (*string)(nil)

		exportString := (*string)(nil)
		err := json.Unmarshal(export, exportString)
		if err == nil {
			matchString = exportString
		}

		if matchString == nil {
			exportObject := (map[string]string)(nil)
			err = json.Unmarshal(export, &exportObject)
			if err == nil {
				exportDefault := exportObject["default"]
				if exportDefault == "" {
					exportDefault = exportObject["import"]
				}
				matchString = &exportDefault
			}
		}

		if matchString == nil {
			continue
		}

		exportComponents := strings.Split(*matchString, "/")

		resolvedComponents := exportComponents[:len(exportComponents)-1]
		resolvedComponents = append(resolvedComponents, subpathComponents[len(subpathComponents)-1])
		resolvedPath := strings.Join(resolvedComponents, "/")
		modulePath := path.Join(moduleDirectory, resolvedPath)
		return &modulePath
	}

	return nil
}

func inferLoader(filePath string) esbuild.Loader {
	pathComponents := strings.Split(filePath, ".")
	ext := pathComponents[len(pathComponents)-1]

	switch ext {
	case "ts":
		return esbuild.LoaderTS
	case "tsx":
		return esbuild.LoaderTSX
	case "js", "mjs", "cjs":
		return esbuild.LoaderJS
	case "jsx":
		return esbuild.LoaderJSX
	case "css":
		return esbuild.LoaderCSS
	}

	return esbuild.LoaderFile
}
