@REM download this compiler and add to PATH env
@REM https://github.com/mstorsjo/llvm-mingw

@ECHO off
SET CGO_ENABLED ="1"
SET GOOS ="windows"

SET GOARCH ="arm64"
go build -buildmode=c-shared -o ../bin/win32-arm64.dll -v ..

SET GOARCH ="amd64"
go build -buildmode=c-shared -o ../bin/win32-x64.dll -v ..

xcopy ..\bin\win32-x64.dll ..\..\platform\windows /y /q
xcopy ..\bin\win32-arm64.dll ..\..\platform\windows /y /q
xcopy ..\..\out\editor ..\..\platform\windows\editor /y /s /e /q