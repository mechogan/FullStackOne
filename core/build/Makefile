OUT = $(CURDIR)/../bin

###### MacOS #######

macos-x86_64:
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=amd64 \
	SDK=macosx \
	CC=$(CURDIR)/apple-clang.sh \
	CGO_CFLAGS="-target x86_64-apple-darwin" \
	go build -buildmode=c-shared -o $(OUT)/macos-x86_64 -v ..

###### iOS/iPadOS #######

ios-arm64:
	CGO_ENABLED=1 \
	GOOS=ios \
	GOARCH=arm64 \
	SDK=iphoneos \
	CC=$(CURDIR)/apple-clang.sh \
	CGO_CFLAGS="-fembed-bitcode" \
	go build -buildmode=c-archive -tags ios -o $(OUT)/ios-arm64.a -v ..

###### Android #######

ANDROID_BIN = $(CURDIR)/../../platform/android/studio/app/src/main/cpp/bin

android-arm:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm \
	CGO_LDFLAGS="-Wl,-soname,android-armeabi-v7a.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/armv7a-linux-androideabi34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-armeabi-v7a.so -v .. && \
	cp $(OUT)/android-armeabi-v7a.so $(ANDROID_BIN)/android-armeabi-v7a.so && \
	cp $(OUT)/android-armeabi-v7a.h $(ANDROID_BIN)/android-armeabi-v7a.h

android-arm64:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm64 \
	CGO_LDFLAGS="-Wl,-soname,android-arm64-v8a.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-arm64-v8a.so -v .. && \
	cp $(OUT)/android-arm64-v8a.so $(ANDROID_BIN)/android-arm64-v8a.so && \
	cp $(OUT)/android-arm64-v8a.h $(ANDROID_BIN)/android-arm64-v8a.h

android-x86_64:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=amd64 \
	CGO_LDFLAGS="-Wl,-soname,android-x86_64.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/x86_64-linux-android34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-x86_64.so -v .. && \
	cp $(OUT)/android-x86_64.so $(ANDROID_BIN)/android-x86_64.so && \
	cp $(OUT)/android-x86_64.h $(ANDROID_BIN)/android-x86_64.h

android: android-arm android-arm64 android-x86_64

###### Windows #######

win-x86_64:
	CGO_ENABLED=1 \
	GOOS=windows \
	GOARCH=amd64 \
	CC=x86_64-w64-mingw32-gcc \
	go build -buildmode=c-shared -o $(OUT)/win-x86_64.dll -v ..

###### Linux #######