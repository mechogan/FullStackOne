// Write C++ code here.
//
// Do not forget to dynamically load the C++ library into your application.
//
// For instance,
//
// In MainActivity.java:
//    static {
//       System.loadLibrary("editor");
//    }
//
// Or, in MainActivity.kt:
//    companion object {
//      init {
//         System.loadLibrary("editor")
//      }
//    }
#include <android/log.h>
#include "editor.h"

#include <cstring>
#include <string>

JNIEXPORT jstring JNICALL Java_org_fullstacked_editor_AdapterEditor_build
        (JNIEnv *env, jobject obj, jstring input, jstring out, jstring nodePath)
{
    const char* inputPtr = env->GetStringUTFChars(input, nullptr);
    const char* outPtr = "index";
    const char* outdirPtr = env->GetStringUTFChars(out, nullptr);
    const char* nodePathPtr = env->GetStringUTFChars(nodePath, nullptr);
    char* errors;

    build(
            const_cast<char*>(inputPtr),
            const_cast<char*>(outPtr),
            const_cast<char*>(outdirPtr),
            const_cast<char*>(nodePathPtr),
            &errors
        );

    return env->NewStringUTF(errors);
}

JNIEXPORT jstring JNICALL Java_org_fullstacked_editor_AdapterEditor_version
        (JNIEnv *env, jobject obj)
{
    char* versionPtr;

    version(&versionPtr);

    return env->NewStringUTF(versionPtr);
}