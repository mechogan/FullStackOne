package fetch

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	serialize "fullstacked/editor/src/serialize"
	"fullstacked/editor/src/setup"
	"io"
	"net/http"
	"time"
)

func FetchSerialized(
	projectId string,
	id int,
	method string,
	url string,
	headers *map[string]string,
	body []byte,
	timeout int,
	asString bool,
) {
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
	bytes := []byte{}
	if err != nil {
		bytes = append(bytes, serialize.SerializeNumber(float64(id))...)
		bytes = append(bytes, serialize.SerializeNumber(float64(500))...)
		bytes = append(bytes, serialize.SerializeString("Failed fecth")...)
		bytes = append(bytes, serialize.SerializeString("{}")...)
		bytes = append(bytes, serialize.SerializeString(err.Error())...)

		setup.Callback(projectId, "fetch-response", base64.StdEncoding.EncodeToString(bytes))
		return
	}
	defer response.Body.Close()

	headersJSON, _ := json.Marshal(response.Header)
	responseBody, _ := io.ReadAll(response.Body)

	bytes = append(bytes, serialize.SerializeNumber(float64(id))...)
	bytes = append(bytes, serialize.SerializeNumber(float64(response.StatusCode))...)
	bytes = append(bytes, serialize.SerializeString(response.Status)...)
	bytes = append(bytes, serialize.SerializeString(string(headersJSON))...)

	if asString {
		bytes = append(bytes, serialize.SerializeString(string(responseBody))...)
	} else {
		bytes = append(bytes, serialize.SerializeBuffer(responseBody)...)
	}

	setup.Callback(projectId, "fetch-response", base64.StdEncoding.EncodeToString(bytes))
}
