package main

import (
	"context"
	"fmt"
	"time"

	"fullstacked/connect/server"
	"fullstacked/connect/client"
)

func main() {
	ctx, cancelCtx := context.WithCancel(context.Background())

	dataServer, _ := server.NewServerWithHostname(8888, "0.0.0.0")
	channel := dataServer.CreateChannel("test")

	channel.OnData = func(a []any) {
		fmt.Println("Server", a)
		if a[0].(string) == "ping" {
			fmt.Println("Server pong")
			time.AfterFunc(time.Second, func() {
				channel.Send([]any{"ping"})
			})
		}
	}

	dataClient, _ := client.NewClientWithHostname("test", 8888, "0.0.0.0")
	dataClient.OnData = func(a []any) {
		fmt.Println("Client", a)
		if a[0].(string) == "ping" {
			fmt.Println("Client pong")
			time.AfterFunc(time.Second, func() {
				dataClient.Send([]any{"ping"})
			})
		}
	}
	dataClient.Send([]any{"ping"})

	<-ctx.Done()
	cancelCtx()
}
