//
// Created by Charles-Philippe Lepage on 2024-07-25.
//

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
