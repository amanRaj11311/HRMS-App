if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/Aman raj/.gradle/caches/9.0.0/transforms/70cc2777d3eef59c7e6917d1f30d89c3/transformed/hermes-android-250829098.0.9-debug/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Aman raj/.gradle/caches/9.0.0/transforms/70cc2777d3eef59c7e6917d1f30d89c3/transformed/hermes-android-250829098.0.9-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

