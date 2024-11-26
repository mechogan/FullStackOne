//
// Created by Charles-Philippe Lepage on 2024-07-25.
//
#ifdef ANDROID_ABI_arm64
#include <android-arm64-v8a.h>
#elif ANDROID_ABI_x64
#include <android-x86_64.h>
#else
#include <android-armeabi-v7a.h>
#endif

#include <jni.h>

#ifndef FULLSTACKED_EDITOR_EDITOR_H
#define FULLSTACKED_EDITOR_EDITOR_H

extern "C" {
    JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_directories
            (JNIEnv *env, jobject jobj, jstring root, jstring config, jstring editor);

    JNIEXPORT jbyteArray JNICALL Java_org_fullstacked_editor_Instance_call
        (JNIEnv *env, jobject jobj, jbyteArray buffer);

    JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved);

    JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_callback(JNIEnv *env, jobject thiz);
}

#endif //FULLSTACKED_EDITOR_EDITOR_H
