package connect

import (
	"fmt"
	"fullstacked/editor/src/serialize"
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
}