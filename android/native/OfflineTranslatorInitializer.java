package uz.safar.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

public final class OfflineTranslatorInitializer extends ContentProvider {
    @Override
    public boolean onCreate() {
        OfflineTranslatorModels.downloadIfNeeded()
                .addOnFailureListener(error -> Log.e("SafarOfflineTranslator",
                        "Unable to download Arabic/Russian translation models at startup", error));
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public String getType(Uri uri) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
