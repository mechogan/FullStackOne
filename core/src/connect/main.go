package connect

import (
	"fullstacked/editor/src/utils"
)

var channels = map[string]Channel{}

func Connect(
	name string,
	port int,
	host string,
) string {
	channelId := utils.RandString(6)
	channel := Channel{
		Name: name,
		Port: port,
		Host: host,
	}
	channel.connect()
	channels[channelId] = channel
    go channel.start()
    return channelId
}

func Send(
	channelId string,
	data []byte,
) {
	channel, ok := channels[channelId]
	if !ok {
		return
	}
	channel.send(data)
}
