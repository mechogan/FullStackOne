#include <android/log.h>
#include "bridge.h"

#include <cstring>
#include <string>
#include <functional>

extern "C" {

JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_directories
        (JNIEnv *env, jobject jobj, jstring root, jstring config, jstring editor) {

    const char* rootPtr = env->GetStringUTFChars(root, nullptr);
    const char* configPtr = env->GetStringUTFChars(config, nullptr);
    const char* editorPtr = env->GetStringUTFChars(editor, nullptr);

    directories(
            const_cast<char*>(rootPtr),
            const_cast<char*>(configPtr),
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

JavaVM* javaVm;
jclass cls;
jobject mainActivity;
std::function<void(char*, char*, char*)> cb;
// can't cast lambda to function (Callback), so use helper
void goCallback(char* projectId, char* messageType, char* message) {
    cb(projectId, messageType, message);
}

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved){
    javaVm = vm;

    JNIEnv *env = nullptr;
    if (javaVm->AttachCurrentThread(&env, nullptr) == JNI_OK) {
        // cache MainActivity class
        jclass clazz = env->FindClass("org/fullstacked/editor/MainActivity");
        cls = (jclass)env->NewGlobalRef(clazz);
    }

    cb = [](char* projectId, char* messageType, char* message) {
        // get JNI env
        JNIEnv *env = nullptr;
        if (javaVm->AttachCurrentThread(&env, nullptr) == JNI_OK) {
            // find method id on cached class
            jmethodID methodid = env->GetMethodID(cls, "Callback", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");

            // callback
            jstring jstr = env->NewStringUTF(projectId);
            jstring jstr2 = env->NewStringUTF(messageType);
            jstring jstr3 = env->NewStringUTF(message);
            env->CallVoidMethod(mainActivity, methodid, jstr, jstr2, jstr3);
        }
    };
    return JNI_VERSION_1_6;
}

JNIEXPORT void JNICALL Java_org_fullstacked_editor_MainActivity_callback
        (JNIEnv * env, jobject thiz)
{
    // cache MainActivity instance
    mainActivity = env->NewGlobalRef(thiz);
    callback((void*)goCallback);
}

}