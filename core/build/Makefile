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

# Mac Catalyst
mac-catalyst-x86_64:
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=amd64 \
	SDK=macosx \
	CC=$(CURDIR)/apple-clang.sh \
	CGO_CFLAGS="-target x86_64-apple-ios-macabi" \
	go build -buildmode=c-archive -tags ios -o $(OUT)/mac-catalyst-x86_64.a -v ..

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

ANDROID_OUT = $(CURDIR)/../../platform/android/studio/app/src/main/cpp/core
NDK_VERSION = 26.3.11579264

android-arm:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm \
	CGO_LDFLAGS="-Wl,-soname,android-armeabi-v7a.so" \
	CC=~/Library/Android/sdk/ndk/$(NDK_VERSION)/toolchains/llvm/prebuilt/darwin-x86_64/bin/armv7a-linux-androideabi34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-armeabi-v7a.so -v .. && \
	mkdir -p $(ANDROID_OUT)/include $(ANDROID_OUT)/lib && \
	cp $(OUT)/android-armeabi-v7a.so $(ANDROID_OUT)/lib/android-armeabi-v7a.so && \
	cp $(OUT)/android-armeabi-v7a.h $(ANDROID_OUT)/include/android-armeabi-v7a.h

android-arm64:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm64 \
	CGO_LDFLAGS="-Wl,-soname,android-arm64-v8a.so" \
	CC=~/Library/Android/sdk/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-arm64-v8a.so -v .. && \
	mkdir -p $(ANDROID_OUT)/include $(ANDROID_OUT)/lib && \
	cp $(OUT)/android-arm64-v8a.so $(ANDROID_OUT)/lib/android-arm64-v8a.so && \
	cp $(OUT)/android-arm64-v8a.h $(ANDROID_OUT)/include/android-arm64-v8a.h

android-x86_64:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=amd64 \
	CGO_LDFLAGS="-Wl,-soname,android-x86_64.so" \
	CC=~/Library/Android/sdk/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/darwin-x86_64/bin/x86_64-linux-android34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-x86_64.so -v .. && \
	mkdir -p $(ANDROID_OUT)/include $(ANDROID_OUT)/lib && \
	cp $(OUT)/android-x86_64.so $(ANDROID_OUT)/lib/android-x86_64.so && \
	cp $(OUT)/android-x86_64.h $(ANDROID_OUT)/include/android-x86_64.h

android: android-arm android-arm64 android-x86_64

###### Windows #######

win-x86_64:
	CGO_ENABLED=1 \
	GOOS=windows \
	GOARCH=amd64 \
	CC=x86_64-w64-mingw32-gcc \
	go build -buildmode=c-shared -o $(OUT)/win-x86_64.dll -v ..

###### Linux #######

###### WebAssembly #######

wasm:
	GOOS=js \
	GOARCH=wasm \
	go build -o $(OUT)/wasm.wasm -v ../wasm && \
	cp $(shell go env GOROOT)/misc/wasm/wasm_exec.js $(OUT)/wasm.js
