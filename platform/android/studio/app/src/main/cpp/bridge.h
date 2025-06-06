//
// Created by Charles-Philippe Lepage on 2024-07-25.
//

#ifdef ANDROID_ABI_arm64
#include "core/arm64-v8a/core.h"
#elif ANDROID_ABI_x64
#include "core/x64/core.h"
#else
#include "core/armeabi-v7a/core.h"
#endif

#include <jni.h>

#ifndef FULLSTACKED_EDITOR_EDITOR_H
#define FULLSTACKED_EDITOR_EDITOR_H

extern "C" {
    JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_directories
            (JNIEnv *env, jobject jobj, jstring root, jstring config, jstring editor);

    JNIEXPORT jbyteArray JNICALL Java_org_fullstacked_editor_Instance_call
        (JNIEnv *env, jobject jobj, jbyteArray payload);

    JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved);

    JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_addCallback(JNIEnv *env, jobject thiz, jint id);
    JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_removeCallback(JNIEnv *env, jobject thiz, jint id);

}

#endif //FULLSTACKED_EDITOR_EDITOR_H
