package serialize

import "math"

const (
	UNDEFINED = 0
	BOOLEAN   = 1
	STRING    = 2
	NUMBER    = 3
	BUFFER    = 4
)

func DeserializeBytesToNumber(bytes []byte) int {
	return int((uint(bytes[0]) << 24) |
		(uint(bytes[1]) << 16) |
		(uint(bytes[2]) << 8) |
		(uint(bytes[3]) << 0))
}

func SerializeNumberToBytes(num int) []byte {
	bytes := []byte{0, 0, 0, 0}
	bytes[0] = uint8((uint(num) & uint(0xff000000)) >> 24)
	bytes[1] = uint8((num & 0x00ff0000) >> 16)
	bytes[2] = uint8((num & 0x0000ff00) >> 8)
	bytes[3] = uint8((num & 0x000000ff) >> 0)
	return bytes
}

func SerializeNumber(num int) []byte {
	negative := num < 0;

	absNum := float64(num)
	if(negative) {
		absNum = 0 - absNum
	}

    bytesNeeded := int(math.Ceil(math.Log(absNum + 1) / math.Log(2) / 8));
	bytes := make([]byte, bytesNeeded + 1)

	if(negative) {
		bytes[0] = 1
	} else {
		bytes[0] = 0
	}

	for i := range(bytesNeeded) {
		mask := math.Pow(2, float64((i + 1) * 8)) - 1
		bytes[i + 1] = uint8(uint(absNum) & uint(mask) >> uint(i * 8))
	}

    return bytes;
}

func SerializeBoolean(value bool) []byte {
	bytes := []byte{BOOLEAN}
	bytes = append(bytes, SerializeNumberToBytes(1)...)
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
	bytes = append(bytes, SerializeNumberToBytes(len(strData))...)
	bytes = append(bytes, strData...)
	return bytes
}

func SerializeBuffer(buffer []byte) []byte {
	bytes := []byte{BUFFER}
	bytes = append(bytes, SerializeNumberToBytes(len(buffer))...)
	bytes = append(bytes, buffer...)
	return bytes
}

func DeserializeNumber(bytes []byte) int {
	negative := bytes[0] == 1

	n := uint(0)
	for i := 1; i < len(bytes); i++ {
		n += uint(bytes[i]) << ((i - 1) * 8)
	}

	if negative {
		return 0 - int(n)
	}

	return int(n)
}

func DeserializeArgs(data []byte) (int, []any) {
	cursor := 0

	method := int(data[cursor])
	cursor++

	var args []any

	for cursor < len(data) {
		argType := int(data[cursor])
		cursor++
		argLength := DeserializeBytesToNumber(data[cursor : cursor+4])
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
