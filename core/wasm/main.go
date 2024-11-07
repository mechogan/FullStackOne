package main

import (
	// methods "fullstacked/editor/src/methods"
	"fmt"
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
	payload := make([]byte, args[0].Get("length").Int());
	_ = js.CopyBytesToGo(payload, args[0])

	for _, b := range(payload) {
		fmt.Println(b)
	}

	response := []byte{5,6,7,8}
	arrayConstructor := js.Global().Get("Uint8Array")
	dataJS := arrayConstructor.New(len(response))
	js.CopyBytesToJS(dataJS, response)

	return dataJS
}

func main() {
	c := make(chan struct{}, 0)

	js.Global().Set("directories", js.FuncOf(directories))
    js.Global().Set("call", js.FuncOf(call))

    <-c
}
