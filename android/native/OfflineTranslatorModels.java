package uz.safar.app;

import com.google.android.gms.tasks.Task;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.TranslateRemoteModel;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import java.util.HashMap;
import java.util.Map;

// Офлайн-перевод Google ML Kit: любой из ~50 языков ML Kit (узбекского и азербайджанского в ML Kit нет).
// Каждый язык — отдельная модель (~30 МБ), скачивается один раз и дальше работает без интернета.
public final class OfflineTranslatorModels {
    private static final Map<String, Translator> translators = new HashMap<>();
    private static Task<Void> defaultDownload;

    private OfflineTranslatorModels() {}

    // Переводчик для пары языков (коды ML Kit: "ar", "ru", "en"…); один на пару, переиспользуется
    public static synchronized Translator getTranslator(String from, String to) {
        String key = from + ">" + to;
        Translator current = translators.get(key);
        if (current == null) {
            TranslatorOptions options = new TranslatorOptions.Builder().setSourceLanguage(from).setTargetLanguage(to).build();
            current = Translation.getClient(options);
            translators.put(key, current);
        }
        return current;
    }

    // Пара по умолчанию для паломников (как раньше): арабский → русский
    public static Translator getTranslator() {
        return getTranslator(TranslateLanguage.ARABIC, TranslateLanguage.RUSSIAN);
    }

    // Скачать модели для пары (обе стороны). wifiOnly — только по Wi‑Fi, чтобы не тратить мобильный трафик
    public static Task<Void> downloadPair(String from, String to, boolean wifiOnly) {
        DownloadConditions.Builder conditions = new DownloadConditions.Builder();
        if (wifiOnly) conditions.requireWifi();
        return getTranslator(from, to).downloadModelIfNeeded(conditions.build());
    }

    // Скачать один язык (модель языка нужна и для перевода «с», и для перевода «на»)
    public static Task<Void> downloadLanguage(String lang, boolean wifiOnly) {
        DownloadConditions.Builder conditions = new DownloadConditions.Builder();
        if (wifiOnly) conditions.requireWifi();
        return RemoteModelManager.getInstance().download(new TranslateRemoteModel.Builder(lang).build(), conditions.build());
    }

    public static Task<Void> deleteLanguage(String lang) {
        return RemoteModelManager.getInstance().deleteDownloadedModel(new TranslateRemoteModel.Builder(lang).build());
    }

    // При запуске приложения — арабский и русский по Wi‑Fi (как раньше, для Мекки)
    public static synchronized Task<Void> downloadIfNeeded() {
        if (defaultDownload != null && (!defaultDownload.isComplete() || defaultDownload.isSuccessful())) return defaultDownload;
        defaultDownload = downloadPair(TranslateLanguage.ARABIC, TranslateLanguage.RUSSIAN, true);
        return defaultDownload;
    }
}
