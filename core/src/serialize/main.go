package serialize

const (
	UNDEFINED = 0
	BOOLEAN   = 1
	STRING    = 2
	NUMBER    = 3
	JSON      = 4
	BUFFER    = 5
)

func DeserializeBytesToNumber(bytes []byte) int {
	return int((uint(bytes[0]) << 24) |
		(uint(bytes[1]) << 16) |
		(uint(bytes[2]) << 8) |
		(uint(bytes[3]) << 0))
}

func SerializeNumberToBytes(num int) []byte {
	bytes := []byte{0, 0, 0, 0}
	bytes[0] = uint8((num & 0xff000000) >> 24)
	bytes[1] = uint8((num & 0x00ff0000) >> 16)
	bytes[2] = uint8((num & 0x0000ff00) >> 8)
	bytes[3] = uint8((num & 0x000000ff) >> 0)
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

func DeserializeArgs(data []byte) (string, []any) {
	cursor := 0
	projectIdLength := DeserializeBytesToNumber(data[cursor : cursor+4])
	cursor += 4
	projectId := string(data[cursor : cursor+projectIdLength])
	cursor += projectIdLength

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
		case JSON:
			// TODO
			args = append(args, nil)
		case BUFFER:
			args = append(args, argData)
		}

	}

	return projectId, args
}
