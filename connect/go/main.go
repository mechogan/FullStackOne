package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	ctx, cancelCtx := context.WithCancel(context.Background())

	server, _ := NewServerWithHostname(8888, "0.0.0.0")
	channel := server.CreateChannel("test")

	channel.OnData = func(a []any) {
		fmt.Println("Server", a)
		if a[0].(string) == "ping" {
			fmt.Println("Server pong")
			time.AfterFunc(time.Second, func() {
				channel.Send([]any{"ping"})
			})
		}
	}

	client, _ := NewClientWithHostname("test", 8888, "0.0.0.0")
	client.OnData = func(a []any) {
		fmt.Println("Client", a)
		if a[0].(string) == "ping" {
			fmt.Println("Client pong")
			time.AfterFunc(time.Second, func() {
				client.Send([]any{"ping"})
			})
		}
	}
	client.Send([]any{"ping"})

	<-ctx.Done()
	cancelCtx()
}
