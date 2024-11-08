@ECHO off
SET CGO_ENABLED ="1"
SET GOOS ="windows"
SET GOARCH ="amd64"
go build -buildmode=c-shared -o ../bin/win-x86_64.dll -v ..

xcopy ..\bin\win-x86_64.dll ..\..\platform\windows\win-x86_64.dll /y /q
xcopy ..\..\out\editor ..\..\platform\windows\editor /y /s /e /q