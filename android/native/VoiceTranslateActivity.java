package uz.safar.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.TranslateRemoteModel;
import com.google.mlkit.nl.translate.Translator;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

// Переводчик без интернета (Google ML Kit): любые языки ML Kit, «Скачать язык» один раз — дальше офлайн, голосом и текстом.
// Открывается со страницы Hamyol: safar://voice-translate?return=<адрес>&from=ar&to=ru[&mode=download]
public final class VoiceTranslateActivity extends Activity {
    private static final int REQUEST_AUDIO = 41;
    private static final String PREFS = "hamyol_translator";
    // Частые языки — первыми; остальные по алфавиту
    private static final List<String> POPULAR = Arrays.asList("ru", "en", "ar", "tr", "ur", "fa", "de", "zh", "ko", "fr", "es", "uk", "kk", "hi");
    private static final Set<String> RTL = new HashSet<>(Arrays.asList("ar", "ur", "fa", "he"));

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<String> languages = new ArrayList<>();
    private final Set<String> downloaded = new HashSet<>();
    private final Set<String> downloading = new HashSet<>();
    private SharedPreferences prefs;
    private Translator translator;
    private SpeechRecognizer recognizer;
    private Uri returnUri;
    private String from = "ar", to = "ru";
    private TextView status, recognized, translated;
    private EditText input;
    private Spinner fromSpinner, toSpinner;
    private Button prepareButton, translateButton, conversationButton;
    private CheckBox wifiOnly;
    private LinearLayout langList;
    private ScrollView scroll;
    private View langSection;
    private boolean speechReady, conversationRequested, recognizing;
    private int speechTranslationRequest;
    private Runnable pendingPartialTranslation;
    private String lastSource = "", lastResult = "";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(11, 31, 58));
        getWindow().setNavigationBarColor(Color.rgb(11, 31, 58));
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        returnUri = safeReturnUri(getIntent());

        // Языки ML Kit: частые первыми
        List<String> all = new ArrayList<>(TranslateLanguage.getAllLanguages());
        Collections.sort(all, (a, b) -> name(a).compareTo(name(b)));
        for (String p : POPULAR) if (all.remove(p)) languages.add(p);
        languages.addAll(all);

        Uri data = getIntent().getData();
        from = pick(data == null ? null : data.getQueryParameter("from"), prefs.getString("from", "ar"));
        to = pick(data == null ? null : data.getQueryParameter("to"), prefs.getString("to", "ru"));
        if (from.equals(to)) to = from.equals("ru") ? "en" : "ru";

        createView();
        checkSpeechSupport();
        refreshDownloaded(() -> {
            selectPair();
            if (data != null && "download".equals(data.getQueryParameter("mode"))) scroll.post(() -> scroll.smoothScrollTo(0, langSection.getTop()));
        });
    }

    private String pick(String requested, String fallback) {
        if (requested != null && TranslateLanguage.getAllLanguages().contains(requested)) return requested;
        return TranslateLanguage.getAllLanguages().contains(fallback) ? fallback : "ru";
    }

    // Название языка по-русски, с большой буквы: «Арабский»
    private static String name(String code) {
        String n = new Locale(code).getDisplayLanguage(new Locale("ru"));
        return n.isEmpty() ? code : n.substring(0, 1).toUpperCase(new Locale("ru")) + n.substring(1);
    }

    private Uri safeReturnUri(Intent intent) {
        String rawReturn = intent.getData() == null ? null : intent.getData().getQueryParameter("return");
        Uri requested = rawReturn == null ? null : Uri.parse(rawReturn);
        String expectedHost = getString(R.string.hostName);
        if (requested != null && "https".equals(requested.getScheme())
                && expectedHost.equalsIgnoreCase(requested.getHost())
                && ("/".equals(requested.getPath()) || "/mecca".equals(requested.getPath()) || "/az".equals(requested.getPath()))) {
            return requested;
        }
        return new Uri.Builder().scheme("https").authority(expectedHost).path("/").fragment("translate").build();
    }

    // ---------- Экран ----------
    private void createView() {
        scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(22), dp(24), dp(22), dp(28));
        page.setBackgroundColor(Color.rgb(247, 242, 233));
        scroll.addView(page);

        page.addView(text("Переводчик без интернета", 26, Color.rgb(11, 31, 58), true));
        page.addView(text("Скачайте нужные языки один раз — дальше перевод и голос работают на телефоне, без интернета.", 16, Color.DKGRAY, false), spaced());

        // Языки: «С какого» ⇄ «На какой»
        LinearLayout pair = new LinearLayout(this);
        pair.setOrientation(LinearLayout.HORIZONTAL);
        pair.setGravity(Gravity.CENTER_VERTICAL);
        fromSpinner = langSpinner();
        toSpinner = langSpinner();
        Button swap = button("⇄");
        swap.setOnClickListener(v -> { String f = from; from = to; to = f; selectPair(); });
        pair.addView(fromSpinner, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        pair.addView(swap, new LinearLayout.LayoutParams(dp(64), ViewGroup.LayoutParams.WRAP_CONTENT));
        pair.addView(toSpinner, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        page.addView(pair, spaced());
        AdapterView.OnItemSelectedListener onPick = new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String code = languages.get(position);
                if (parent == fromSpinner && !code.equals(from)) { from = code; if (from.equals(to)) to = from.equals("ru") ? "en" : "ru"; selectPair(); }
                if (parent == toSpinner && !code.equals(to)) { to = code; if (from.equals(to)) from = to.equals("ru") ? "en" : "ru"; selectPair(); }
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        };
        // Сначала — нужные языки, потом слушатель: иначе первое событие Android выставило бы первый язык списка
        fromSpinner.setSelection(languages.indexOf(from), false);
        toSpinner.setSelection(languages.indexOf(to), false);
        fromSpinner.setOnItemSelectedListener(onPick);
        toSpinner.setOnItemSelectedListener(onPick);

        status = text("Проверяем языки…", 15, Color.rgb(72, 82, 75), false);
        page.addView(status, spaced());
        prepareButton = button("Скачать эти языки");
        prepareButton.setOnClickListener(v -> downloadPair());
        page.addView(prepareButton, spaced());

        input = new EditText(this);
        input.setHint("Введите текст");
        input.setTextSize(20);
        input.setMinLines(2);
        input.setMaxLines(5);
        page.addView(input, spaced());
        translateButton = button("Перевести");
        translateButton.setOnClickListener(v -> translateTyped());
        page.addView(translateButton, spaced());

        recognized = text("", 21, Color.rgb(30, 42, 35), false);
        page.addView(recognized, spaced());
        translated = text("", 24, Color.rgb(11, 31, 58), true);
        page.addView(translated, spaced());

        conversationButton = button("Говорить голосом");
        conversationButton.setOnClickListener(v -> toggleConversation());
        page.addView(conversationButton, spaced());

        Button returnButton = button("Вернуться в Hamyol");
        returnButton.setOnClickListener(v -> returnToApp());
        page.addView(returnButton, spaced());

        // Скачанные языки
        LinearLayout section = new LinearLayout(this);
        section.setOrientation(LinearLayout.VERTICAL);
        langSection = section;
        section.addView(text("Языки на телефоне", 22, Color.rgb(11, 31, 58), true), spaced());
        section.addView(text("Каждый язык — около 30 МБ. Скачанный язык работает без интернета. Узбекского и азербайджанского в офлайн-переводчике Google пока нет — для них в приложении есть готовые фразы.", 14, Color.rgb(92, 98, 92), false), spaced());
        wifiOnly = new CheckBox(this);
        wifiOnly.setText("Скачивать только по Wi‑Fi");
        wifiOnly.setTextSize(16);
        wifiOnly.setChecked(prefs.getBoolean("wifiOnly", true));
        wifiOnly.setOnCheckedChangeListener((b, on) -> prefs.edit().putBoolean("wifiOnly", on).apply());
        section.addView(wifiOnly, spaced());
        langList = new LinearLayout(this);
        langList.setOrientation(LinearLayout.VERTICAL);
        section.addView(langList, spaced());
        Button speechSettings = button("Голос без интернета: настройки Android");
        speechSettings.setOnClickListener(v -> openSpeechSettings());
        section.addView(speechSettings, spaced());
        page.addView(section);
        setContentView(scroll);
    }

    private Spinner langSpinner() {
        Spinner s = new Spinner(this);
        List<String> labels = new ArrayList<>();
        for (String code : languages) labels.add(name(code));
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        s.setAdapter(adapter);
        return s;
    }

    // Выбрана пара языков: переводчик, направление текста, готовность
    private void selectPair() {
        prefs.edit().putString("from", from).putString("to", to).apply();
        fromSpinner.setSelection(languages.indexOf(from));
        toSpinner.setSelection(languages.indexOf(to));
        translator = OfflineTranslatorModels.getTranslator(from, to);
        boolean rtl = RTL.contains(from);
        input.setTextDirection(rtl ? View.TEXT_DIRECTION_RTL : View.TEXT_DIRECTION_LTR);
        input.setTextLocale(new Locale(from));
        input.setHint("Текст: " + name(from).toLowerCase(new Locale("ru")));
        recognized.setTextDirection(rtl ? View.TEXT_DIRECTION_RTL : View.TEXT_DIRECTION_LTR);
        translated.setTextDirection(RTL.contains(to) ? View.TEXT_DIRECTION_RTL : View.TEXT_DIRECTION_LTR);
        translateButton.setText("Перевести: " + name(from) + " → " + name(to));
        updateReady();
    }

    // Английская модель есть в ML Kit всегда; остальные — после скачивания
    private boolean has(String lang) { return "en".equals(lang) || downloaded.contains(lang); }

    private void updateReady() {
        boolean ready = has(from) && has(to);
        translateButton.setEnabled(ready);
        conversationButton.setEnabled(ready && speechReady && recognizer != null);
        boolean busy = downloading.contains(from) || downloading.contains(to);
        prepareButton.setVisibility(ready ? View.GONE : View.VISIBLE);
        prepareButton.setEnabled(!busy);
        prepareButton.setText(busy ? "Скачиваем…" : "Скачать: " + (has(from) ? "" : name(from)) + (!has(from) && !has(to) ? " и " : "") + (has(to) ? "" : name(to)));
        status.setText(ready ? (speechReady ? "Готово — работает без интернета, текстом и голосом." : "Готово — перевод текста работает без интернета.")
                : busy ? "Скачиваем языки… Это займёт минуту-две." : "Чтобы переводить без интернета, один раз скачайте эти языки.");
        renderLangList();
    }

    private void refreshDownloaded(Runnable then) {
        RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel.class)
                .addOnSuccessListener(models -> runOnUiThread(() -> {
                    downloaded.clear();
                    for (TranslateRemoteModel m : models) downloaded.add(m.getLanguage());
                    if (then != null) then.run(); else updateReady();
                }))
                .addOnFailureListener(e -> runOnUiThread(() -> { if (then != null) then.run(); }));
    }

    private void downloadPair() {
        for (String lang : new String[]{from, to}) if (!has(lang)) downloadLanguage(lang);
    }

    private void downloadLanguage(String lang) {
        if (downloading.contains(lang)) return;
        downloading.add(lang);
        updateReady();
        OfflineTranslatorModels.downloadLanguage(lang, wifiOnly.isChecked())
                .addOnSuccessListener(v -> runOnUiThread(() -> { downloading.remove(lang); downloaded.add(lang); updateReady(); }))
                .addOnFailureListener(e -> runOnUiThread(() -> {
                    downloading.remove(lang);
                    updateReady();
                    status.setText(wifiOnly.isChecked() ? "Не удалось скачать: нужен Wi‑Fi. Подключитесь к Wi‑Fi или снимите галочку «только по Wi‑Fi»." : "Не удалось скачать. Проверьте интернет и попробуйте ещё раз.");
                }));
    }

    private void deleteLanguage(String lang) {
        OfflineTranslatorModels.deleteLanguage(lang)
                .addOnCompleteListener(t -> runOnUiThread(() -> refreshDownloaded(null)));
    }

    // Список всех языков: скачан ли, кнопка «Скачать» или «Удалить»
    private void renderLangList() {
        langList.removeAllViews();
        for (String lang : languages) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(6), 0, dp(6));
            String state = "en".equals(lang) ? "  ✓ встроен" : downloaded.contains(lang) ? "  ✓ скачан" : downloading.contains(lang) ? "  … скачивается" : "";
            TextView label = text(name(lang) + state, 17, Color.rgb(30, 42, 35), downloaded.contains(lang));
            row.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            if (!"en".equals(lang) && !downloading.contains(lang)) {
                Button b = button(downloaded.contains(lang) ? "Удалить" : "Скачать");
                b.setOnClickListener(v -> { if (downloaded.contains(lang)) deleteLanguage(lang); else downloadLanguage(lang); });
                row.addView(b);
            }
            langList.addView(row);
        }
    }

    // ---------- Перевод ----------
    private void translateTyped() {
        String text = input.getText().toString().trim();
        if (text.isEmpty()) { input.setError("Введите текст"); return; }
        translateButton.setEnabled(false);
        status.setText("Переводим на телефоне…");
        translator.translate(text)
                .addOnSuccessListener(result -> runOnUiThread(() -> {
                    lastSource = text; lastResult = result;
                    recognized.setText(text);
                    translated.setText(result);
                    status.setText("Готово — переведено без интернета.");
                    updateReady();
                }))
                .addOnFailureListener(e -> runOnUiThread(() -> { status.setText("Не удалось перевести. Проверьте, что оба языка скачаны."); updateReady(); }));
    }

    // ---------- Голос ----------
    private String speechTag(String lang) {
        switch (lang) {
            case "ar": return "ar-SA"; case "ru": return "ru-RU"; case "en": return "en-US"; case "tr": return "tr-TR"; case "ur": return "ur-PK";
            case "fa": return "fa-IR"; case "de": return "de-DE"; case "zh": return "zh-CN"; case "ko": return "ko-KR"; case "fr": return "fr-FR";
            case "es": return "es-ES"; case "uk": return "uk-UA"; case "hi": return "hi-IN"; default: return lang;
        }
    }

    private void checkSpeechSupport() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
        try {
            if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) return;
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { status.setText("Слушаю…"); }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() { status.setText("Распознаём речь на телефоне…"); }
                @Override public void onError(int error) { handleSpeechError(error); }
                @Override public void onResults(Bundle results) { handleSpeechResults(results); }
                @Override public void onPartialResults(Bundle results) { showPartialResult(results); }
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            speechReady = true;
        } catch (RuntimeException ignored) {
            speechReady = false;
        }
    }

    private void toggleConversation() {
        if (conversationRequested) {
            conversationRequested = false;
            cancelPendingPartialTranslation();
            if (recognizer != null) { recognizer.cancel(); recognizing = false; }
            conversationButton.setText("Говорить голосом");
            status.setText("Остановлено.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
            return;
        }
        conversationRequested = true;
        conversationButton.setText("Закончить");
        startListening();
    }

    private void startListening() {
        if (!conversationRequested || recognizing || recognizer == null) return;
        Intent speech = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechTag(from));
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, speechTag(from));
        speech.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        speech.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        try {
            recognizing = true;
            recognizer.startListening(speech);
        } catch (RuntimeException error) {
            recognizing = false;
            conversationRequested = false;
            conversationButton.setText("Говорить голосом");
            status.setText("Голос на этом языке без интернета недоступен. Скачайте его в настройках голосового ввода Android.");
        }
    }

    private void showPartialResult(Bundle bundle) {
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        String partial = matches.get(0).trim();
        if (partial.isEmpty()) return;
        recognized.setText(partial);
        cancelPendingPartialTranslation();
        pendingPartialTranslation = () -> translateSpeech(partial, false);
        handler.postDelayed(pendingPartialTranslation, 300);
    }

    private void handleSpeechResults(Bundle bundle) {
        recognizing = false;
        cancelPendingPartialTranslation();
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty() || matches.get(0).trim().isEmpty()) { restartListening(); return; }
        lastSource = matches.get(0).trim();
        recognized.setText(lastSource);
        translateSpeech(lastSource, true);
    }

    private void translateSpeech(String text, boolean finalResult) {
        int request = ++speechTranslationRequest;
        if (finalResult) status.setText("Переводим на телефоне…");
        translator.translate(text)
                .addOnSuccessListener(result -> runOnUiThread(() -> {
                    if (request != speechTranslationRequest) return;
                    lastSource = text; lastResult = result;
                    translated.setText(result);
                    if (finalResult) { status.setText("Готово — без интернета."); restartListening(); }
                }))
                .addOnFailureListener(error -> runOnUiThread(() -> {
                    if (request != speechTranslationRequest || !finalResult) return;
                    status.setText("Перевод не удался. Проверьте, что оба языка скачаны.");
                    restartListening();
                }));
    }

    private void cancelPendingPartialTranslation() {
        if (pendingPartialTranslation != null) { handler.removeCallbacks(pendingPartialTranslation); pendingPartialTranslation = null; }
        speechTranslationRequest++;
    }

    private void handleSpeechError(int error) {
        recognizing = false;
        cancelPendingPartialTranslation();
        if (!conversationRequested) return;
        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { restartListening(); return; }
        conversationRequested = false;
        conversationButton.setText("Говорить голосом");
        status.setText(error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE
                ? "Голос на языке «" + name(from) + "» без интернета не скачан. Скачайте его в настройках голосового ввода Android."
                : "Не удалось распознать речь. Проверьте разрешение на микрофон.");
    }

    private void restartListening() { if (conversationRequested) handler.postDelayed(this::startListening, 450); }

    private void openSpeechSettings() {
        try { startActivity(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)); }
        catch (ActivityNotFoundException error) { status.setText("Откройте настройки Android → Язык и ввод → Голосовой ввод и скачайте нужные языки."); }
    }

    // ---------- Назад в Hamyol: последний перевод попадает в историю переводчика на сайте ----------
    private void returnToApp() {
        conversationRequested = false;
        cancelPendingPartialTranslation();
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) { recognizer.cancel(); recognizing = false; }
        Uri.Builder builder = returnUri.buildUpon().clearQuery().fragment("translate");
        if (!lastSource.isEmpty() && !lastResult.isEmpty()) {
            builder.appendQueryParameter("safar_voice_text", lastSource);
            builder.appendQueryParameter("safar_voice_translation", lastResult);
            builder.appendQueryParameter("safar_voice_from", from);
            builder.appendQueryParameter("safar_voice_to", to);
        }
        Intent back = new Intent(Intent.ACTION_VIEW, builder.build());
        back.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(back);
        finish();
    }

    @Override public void onBackPressed() { returnToApp(); }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_AUDIO) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            conversationRequested = true;
            conversationButton.setText("Закончить");
            startListening();
        } else {
            status.setText("Для голосового перевода нужно разрешение на микрофон.");
        }
    }

    @Override
    protected void onDestroy() {
        cancelPendingPartialTranslation();
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) { recognizer.cancel(); recognizer.destroy(); }
        super.onDestroy();
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD);
        return view;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(16);
        return button;
    }

    private LinearLayout.LayoutParams spaced() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(14);
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
