if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/Aman raj/.gradle/caches/9.0.0/transforms/67c689aabd534bc5baf3a4be169d43be/transformed/hermes-android-250829098.0.9-release/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Aman raj/.gradle/caches/9.0.0/transforms/67c689aabd534bc5baf3a4be169d43be/transformed/hermes-android-250829098.0.9-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

