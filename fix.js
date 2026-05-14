const fs = require('fs');

const targetPath = './node_modules/react-native-document-picker/android/src/main/java/com/reactnativedocumentpicker/RNDocumentPickerModule.java';

const fixedJavaCode = `package com.reactnativedocumentpicker;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import com.facebook.react.bridge.*;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.UUID;

public class RNDocumentPickerModule extends ReactContextBaseJavaModule {
    // 🚀 FIXED: Changed from private to public
    public static final String NAME = "RNDocumentPicker";
    private static final int READ_REQUEST_CODE = 41;
    private Promise promise;

    private final ActivityEventListener activityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == READ_REQUEST_CODE && promise != null) {
                if (resultCode == Activity.RESULT_CANCELED) {
                    promise.reject("DOCUMENT_PICKER_CANCELED", "User canceled");
                } else if (resultCode == Activity.RESULT_OK && data != null) {
                    Uri uri = data.getData();
                    if (uri != null) {
                        new Thread(() -> {
                            try {
                                WritableArray results = Arguments.createArray();
                                results.pushMap(getMetadata(uri));
                                promise.resolve(results);
                            } catch (Exception e) {
                                promise.reject("DOCUMENT_PICKER_ERROR", e.getMessage(), e);
                            }
                        }).start();
                    } else if (data.getClipData() != null) {
                        ClipData clipData = data.getClipData();
                        new Thread(() -> {
                            try {
                                WritableArray results = Arguments.createArray();
                                for (int i = 0; i < clipData.getItemCount(); i++) {
                                    results.pushMap(getMetadata(clipData.getItemAt(i).getUri()));
                                }
                                promise.resolve(results);
                            } catch (Exception e) {
                                promise.reject("DOCUMENT_PICKER_ERROR", e.getMessage(), e);
                            }
                        }).start();
                    }
                }
                promise = null;
            }
        }
    };

    public RNDocumentPickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(activityEventListener);
    }

    @Override
    public String getName() { return NAME; }

    @ReactMethod
    public void pick(ReadableMap options, Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("DOCUMENT_PICKER_ERROR", "Activity is null");
            return;
        }
        this.promise = promise;
        try {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            if (options.hasKey("type")) {
                ReadableArray types = options.getArray("type");
                if (types != null && types.size() > 0) {
                    if (types.size() > 1) {
                        String[] mimeTypes = new String[types.size()];
                        for (int i = 0; i < types.size(); i++) mimeTypes[i] = types.getString(i);
                        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
                    } else {
                        intent.setType(types.getString(0));
                    }
                }
            }
            boolean multiple = options.hasKey("allowMultiSelection") && options.getBoolean("allowMultiSelection");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            currentActivity.startActivityForResult(intent, READ_REQUEST_CODE);
        } catch (Exception e) {
            this.promise.reject("DOCUMENT_PICKER_ERROR", e.getMessage(), e);
            this.promise = null;
        }
    }

    @ReactMethod
    public void pickDirectory(ReadableMap options, Promise promise) {
         promise.reject("NOT_IMPLEMENTED", "pickDirectory is disabled in patch.");
    }

    private WritableMap getMetadata(Uri uri) {
        WritableMap map = Arguments.createMap();
        map.putString("uri", uri.toString());
        String name = null;
        String type = null;
        int size = 0;
        ReactApplicationContext reactContext = getReactApplicationContext();

        if ("content".equals(uri.getScheme())) {
            Cursor cursor = reactContext.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIndex != -1) name = cursor.getString(nameIndex);
                        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                        if (sizeIndex != -1) size = cursor.getInt(sizeIndex);
                    }
                } finally {
                    cursor.close();
                }
            }
            type = reactContext.getContentResolver().getType(uri);
        } else if ("file".equals(uri.getScheme())) {
            name = uri.getLastPathSegment();
            type = "application/octet-stream";
        }

        if (name == null) name = "document_" + UUID.randomUUID().toString();

        try {
            File cacheDir = reactContext.getCacheDir();
            File tempFile = new File(cacheDir, name);
            InputStream is = reactContext.getContentResolver().openInputStream(uri);
            FileOutputStream fos = new FileOutputStream(tempFile);
            byte[] buffer = new byte[1024];
            int length;
            while ((length = is.read(buffer)) > 0) fos.write(buffer, 0, length);
            fos.flush(); fos.close(); is.close();
            map.putString("fileCopyUri", "file://" + tempFile.getAbsolutePath());
        } catch (Exception e) {
             Log.e(NAME, "Cache copy failed", e);
        }

        map.putString("name", name);
        map.putString("type", type != null ? type : "application/octet-stream");
        map.putInt("size", size);
        return map;
    }
}`;

try {
    fs.writeFileSync(targetPath, fixedJavaCode);
    console.log("✅ FIXED: 'NAME' is now public. Ready to build!");
} catch (error) {
    console.error("❌ Error fixing file:", error);
}