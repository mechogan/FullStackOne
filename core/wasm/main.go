package main

import (
	"fmt"
	fs "fullstacked/editor/src/fs"
	methods "fullstacked/editor/src/methods"
	setup "fullstacked/editor/src/setup"
	"strings"

	"syscall/js"
)

func directories(this js.Value, args []js.Value) interface{} {
	setup.SetupDirectories(
		args[0].String(),
		args[1].String(),
		args[2].String(),
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
	fileMap := make(map[string]interface{})

	prefix := ""
	if len(args) == 1 {
		prefix = args[0].String()
	}

	arrayConstructor := js.Global().Get("Uint8Array")

	for name, f := range fs.VirtFS {
		if !strings.HasPrefix(name, prefix) {
			continue
		}

		dataJS := arrayConstructor.New(len(f.Data))
		js.CopyBytesToJS(dataJS, f.Data)

		fileMap[name] = dataJS
	}

	for _, dir := range fs.VirtDirs {
		if !strings.HasPrefix(dir, prefix) {
			continue
		}

		fileMap[dir] = nil
	}

	return js.ValueOf(fileMap)
}

func callback(projectId string, messageType string, message string) {
	js.Global().Call("onmessageWASM", js.ValueOf(projectId), js.ValueOf(messageType), js.ValueOf(message))
}

func main() {
	c := make(chan struct{}, 0)

	fmt.Println("FullStacked WASM")
	fs.WASM = true

	setup.Callback = callback
	js.Global().Set("directories", js.FuncOf(directories))
	js.Global().Set("call", js.FuncOf(call))
	js.Global().Set("vfs", js.FuncOf(vfs))

	<-c
}
