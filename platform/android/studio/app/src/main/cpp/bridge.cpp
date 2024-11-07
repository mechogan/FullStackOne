#include <android/log.h>
#include "bridge.h"

#include <cstring>
#include <string>


JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_directories
        (JNIEnv *env, jobject jobj, jstring root, jstring config, jstring nodeModules, jstring editor) {

    const char* rootPtr = env->GetStringUTFChars(root, nullptr);
    const char* configPtr = env->GetStringUTFChars(config, nullptr);
    const char* nodeModulesPtr = env->GetStringUTFChars(nodeModules, nullptr);
    const char* editorPtr = env->GetStringUTFChars(editor, nullptr);

    directories(
        const_cast<char*>(rootPtr),
        const_cast<char*>(configPtr),
        const_cast<char*>(nodeModulesPtr),
        const_cast<char*>(editorPtr)
    );
}


JNIEXPORT jbyteArray JNICALL Java_org_fullstacked_editor_Instance_call
        (JNIEnv *env, jobject obj, jbyteArray buffer)
{

    int length = env->GetArrayLength(buffer);
    void* responsePtr;

    int size = call(env->GetByteArrayElements(buffer, nullptr), length, &responsePtr);

    jbyteArray response = env->NewByteArray(size);
    env->SetByteArrayRegion(response, 0, size, (jbyte*)responsePtr);

    freePtr(responsePtr);

    return response;
}
