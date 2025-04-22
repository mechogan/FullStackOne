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

func Connect(name string, port int, host string){
	fmt.Println("Connecting to " + host + ":" + strconv.Itoa(port));

	conn, err := net.Dial("tcp", host + ":" + strconv.Itoa(port))
    if err != nil {
        fmt.Println(err)
        return
    }

    _, err = conn.Write(serialize.SerializeString(name))
    if err != nil {
        fmt.Println(err)
        return
    }

    for {
        buf := make([]byte, 1024)
        size, err := bufio.NewReader(conn).Read(buf)
        if err != nil {
            fmt.Println(err.Error())
            return
        }
        setup.Callback("", "socket-data", base64.RawStdEncoding.EncodeToString(buf[0:size]))
    }
}