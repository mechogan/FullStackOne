package connect

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"fullstacked/editor/src/serialize"
	"fullstacked/editor/src/setup"
	"net"
	"strconv"
)

type Channel struct {
	ProjectId string
	Id string
	Name string
	Port int
	Host string
	Raw bool
	buffer []byte
	conn net.Conn
}

func (c *Channel) connect() {
	fmt.Println("Connecting to " + c.Host + ":" + strconv.Itoa(c.Port))

	conn, err := net.Dial("tcp", c.Host+":"+strconv.Itoa(c.Port))
	if err != nil {
		fmt.Println(err)
		return
	}

	_, err = conn.Write(serialize.SerializeString(c.Name))
	if err != nil {
		fmt.Println(err)
		return
	}

	c.conn = conn;
}

func (c *Channel) start() {
	if(c.conn == nil) {
		return;
	}
	
	for {
		buf := make([]byte, 1024)
		size, err := bufio.NewReader(c.conn).Read(buf)
		if err != nil {
			fmt.Println(err.Error())
			return
		}

		if(c.Raw) {
			setup.Callback(c.ProjectId, "channel-" + c.Id, base64.RawStdEncoding.EncodeToString(buf[0:size]))
		} else {
			c.buffer = append(c.buffer, buf...)
			c.receive()
		}
	}
}

func (c *Channel) receive(){
	
}

func (c *Channel) send(data []byte) {
	if(c.conn == nil) {
		return
	}
	c.conn.Write(data)
}
