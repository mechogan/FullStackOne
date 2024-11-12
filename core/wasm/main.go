package main

import (
	"encoding/json"
	"fmt"
	fs "fullstacked/editor/src/fs"
	methods "fullstacked/editor/src/methods"
	setup "fullstacked/editor/src/setup"

	"syscall/js"
)

func directories(this js.Value, args []js.Value) interface{} {
	setup.SetupDirectories(
		args[0].String(),
		args[1].String(),
		args[2].String(),
		args[3].String(),
	)
	return nil
}

func call(this js.Value, args []js.Value) interface{} {
	payload := make([]byte, args[0].Get("length").Int())
	_ = js.CopyBytesToGo(payload, args[0])

	response := methods.Call(payload)
	arrayConstructor := js.Global().Get("Uint8Array")
	dataJS := arrayConstructor.New(len(response))
	js.CopyBytesToJS(dataJS, response)

	return dataJS
}

func vfs(this js.Value, args []js.Value) interface{} {
	fileMap := make(map[string]int)

	for file, data := range(fs.VirtFS) {
		fileMap[file] = len(data)
	}

	for _, dir := range(fs.VirtDirs) {
		fileMap[dir] = 0
	}

	jsonString, _ := json.Marshal(fileMap)
	
	return js.ValueOf(string(jsonString))
} 

func main() {
	c := make(chan struct{}, 0)

	fmt.Println("FullStacked WASM")
	fs.WASM = true

	js.Global().Set("directories", js.FuncOf(directories))
	js.Global().Set("call", js.FuncOf(call))
	js.Global().Set("vfs", js.FuncOf(vfs))

	<-c
}
