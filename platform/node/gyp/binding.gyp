{
    "targets": [
        {
            "target_name": "core",
            "sources": [ "bridge.cc" ],
            "include_dirs": [
                "<!@(node -p \"require('node-addon-api').include\")"
            ],
            "libraries": [ "/Users/cplepage/fullstackedorg/fullstacked/core/bin/darwin-x64.a" ],
            "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
        }
    ]
} 