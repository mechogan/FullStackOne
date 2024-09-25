//
// Created by Charles-Philippe Lepage on 2024-07-25.
//
#include <jni.h>
#ifdef ANDROID_ABI_arm64
#include "esbuild/arm64-v8a/esbuild.h"
#elif ANDROID_ABI_x64
#include "esbuild/x86_64/esbuild.h"
#else
#include "esbuild/armeabi-v7a/esbuild.h"
#endif

#ifndef FULLSTACKED_EDITOR_EDITOR_H
#define FULLSTACKED_EDITOR_EDITOR_H

extern "C" {

JNIEXPORT jstring JNICALL Java_org_fullstacked_editor_AdapterEditor_build
        (JNIEnv *env, jobject jobj, jstring input, jstring out, jstring nodePath);


JNIEXPORT jstring JNICALL Java_org_fullstacked_editor_AdapterEditor_version
        (JNIEnv *env, jobject jobj);

}

#endif //FULLSTACKED_EDITOR_EDITOR_H
