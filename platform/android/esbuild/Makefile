# go/Makefile

ESBUILD_DIR = $(CURDIR)/../../../lib/esbuild
GO_EXEC = $(CURDIR)/../../../lib/go/bin/go
ANDROID_OUT = $(CURDIR)/../studio/app/src/main/cpp/esbuild

android-arm:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/../../ios/esbuild/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm \
	CGO_LDFLAGS="-Wl,-soname,esbuild.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/armv7a-linux-androideabi34-clang \
	$(GO_EXEC) build -buildmode=c-shared -o $(ANDROID_OUT)/armeabi-v7a/esbuild.so ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

android-arm64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/../../ios/esbuild/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm64 \
	CGO_LDFLAGS="-Wl,-soname,esbuild.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android34-clang \
	$(GO_EXEC) build -buildmode=c-shared -o $(ANDROID_OUT)/arm64-v8a/esbuild.so ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

android-x86_64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/../../ios/esbuild/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=amd64 \
	CGO_LDFLAGS="-Wl,-soname,esbuild.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/x86_64-linux-android34-clang \
	$(GO_EXEC) build -buildmode=c-shared -o $(ANDROID_OUT)/x86_64/esbuild.so ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

android: android-arm android-arm64 android-x86_64
