package serialize

import (
	"encoding/binary"
	"math"
)

const (
	UNDEFINED = 0
	BOOLEAN   = 1
	STRING    = 2
	NUMBER    = 3
	BUFFER    = 4
)

func DeserializeBytesToInt(bytes []byte) int {
	return int((uint(bytes[0]) << 24) |
		(uint(bytes[1]) << 16) |
		(uint(bytes[2]) << 8) |
		(uint(bytes[3]) << 0))
}

func SerializeIntToBytes(num int) []byte {
	bytes := []byte{0, 0, 0, 0}
	bytes[0] = uint8((uint(num) & uint(0xff000000)) >> 24)
	bytes[1] = uint8((num & 0x00ff0000) >> 16)
	bytes[2] = uint8((num & 0x0000ff00) >> 8)
	bytes[3] = uint8((num & 0x000000ff) >> 0)
	return bytes
}

func SerializeNumber(num float64) []byte {
	bytes := []byte{NUMBER}
	bytes = append(bytes, SerializeIntToBytes(8)...)
	float64Bytes := make([]byte, 8)
	binary.BigEndian.PutUint64(float64Bytes[:], math.Float64bits(num))
	bytes = append(bytes, float64Bytes...)
	return bytes
}

func SerializeBoolean(value bool) []byte {
	bytes := []byte{BOOLEAN}
	bytes = append(bytes, SerializeIntToBytes(1)...)
	if value {
		bytes = append(bytes, 1)
	} else {
		bytes = append(bytes, 0)
	}
	return bytes
}

func SerializeString(str string) []byte {
	bytes := []byte{STRING}
	strData := []byte(str)
	bytes = append(bytes, SerializeIntToBytes(len(strData))...)
	bytes = append(bytes, strData...)
	return bytes
}

func SerializeBuffer(buffer []byte) []byte {
	bytes := []byte{BUFFER}
	bytes = append(bytes, SerializeIntToBytes(len(buffer))...)
	bytes = append(bytes, buffer...)
	return bytes
}

func DeserializeNumber(bytes []byte) float64 {
	bits := binary.LittleEndian.Uint64(bytes)
    float := math.Float64frombits(bits)
    return float
}

func DeserializeArgs(data []byte) (int, []any) {
	cursor := 0

	method := int(data[cursor])
	cursor++

	var args []any

	for cursor < len(data) {
		argType := int(data[cursor])
		cursor++
		argLength := DeserializeBytesToInt(data[cursor : cursor+4])
		cursor += 4
		argData := data[cursor : cursor+argLength]
		cursor += argLength

		switch argType {
		case UNDEFINED:
			args = append(args, nil)
		case BOOLEAN:
			args = append(args, argData[0] == 1)
		case STRING:
			args = append(args, string(argData))
		case NUMBER:
			args = append(args, DeserializeNumber(argData))
		case BUFFER:
			args = append(args, argData)
		}

	}

	return method, args
}
