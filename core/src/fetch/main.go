package fetch

import (
	"bytes"
	"encoding/json"
	serialize "fullstacked/editor/src/serialize"
	"io"
	"net/http"
	"time"
)

func FetchSerialized(
	method string,
	url string,
	headers *map[string]string,
	body []byte,
	timeout int,
	asString bool,
) []byte {

	requestBody := (io.Reader)(http.NoBody)
	if len(body) > 0 {
		requestBody = bytes.NewReader(body)
	}

	request, _ := http.NewRequest(method, url, requestBody)

	if headers != nil {
		for key, value := range *headers {
			request.Header.Set(key, value)
		}
	}

	client := &http.Client{}

	client.Timeout = time.Duration(timeout) * time.Second

	response, err := client.Do(request)
	if err != nil {

	}
	defer response.Body.Close()

	headersJSON, _ := json.Marshal(response.Header)
	responseBody, _ := io.ReadAll(response.Body)

	bytes := []byte{}

	bytes = append(bytes, serialize.SerializeNumber(float64(response.StatusCode))...)
	bytes = append(bytes, serialize.SerializeString(response.Status)...)
	bytes = append(bytes, serialize.SerializeString(string(headersJSON))...)

	if asString {
		bytes = append(bytes, serialize.SerializeString(string(responseBody))...)
	} else {
		bytes = append(bytes, serialize.SerializeBuffer(responseBody)...)
	}

	return bytes
}
