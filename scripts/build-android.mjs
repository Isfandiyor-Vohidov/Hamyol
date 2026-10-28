// Сборка Android-приложения Safar (APK) — Trusted Web Activity через Google Bubblewrap.
// Приложение открывает сайт по адресу --url во весь экран, без адресной строки (если сайт отдаёт assetlinks.json).
//
// Запуск:  npm run android -- --url https://ваш-адрес
//   --url    публичный HTTPS-адрес сайта (по умолчанию PUBLIC_URL из .env). Встраивается в APK навсегда.
//
// Сервер Safar для сборки запускать не нужно: манифест и иконки скрипт раздаёт сам с временного локального адреса.
// Первый запуск скачивает JDK 17 (Adoptium) и Android SDK (Google) в ~/.bubblewrap (~1,5 ГБ вместе с Gradle)
// и просит принять лицензию Android SDK. Результат: android/safar.apk и android/assetlinks.json — их раздаёт сервер.
// Ключ подписи: android/safar.keystore, пароли — android/signing.json. Не теряйте их: без того же ключа
// обновление не встанет поверх установленного приложения.
import { existsSync, cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, rmSync, createWriteStream } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Config, JdkHelper, AndroidSdkTools, KeyTool, TwaManifest, TwaGenerator, DigitalAssetLinks, ConsoleLog } from "@bubblewrap/core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "android");
const TOOLS = join(homedir(), ".bubblewrap");
const PACKAGE_ID = "uz.safar.app";
const log = new ConsoleLog("android");

// ---------- Параметры ----------
const env = Object.fromEntries((existsSync(join(ROOT, ".env")) ? readFileSync(join(ROOT, ".env"), "utf8") : "")
  .split(/\r?\n/).map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const arg = name => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : undefined; };
const PUBLIC = (arg("url") || env.PUBLIC_URL || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(PUBLIC)) {
  console.error("Укажите публичный HTTPS-адрес: npm run android -- --url https://ваш-адрес  (или PUBLIC_URL в .env)");
  process.exit(1);
}

// ---------- Инструменты: JDK 17 и Android SDK ----------
async function download(url, file) {
  log.info(`Скачиваю ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}
function unzip(zip, dir) {
  mkdirSync(dir, { recursive: true });
  // В Windows 10+ есть встроенный tar, он умеет zip; в macOS и Linux — unzip
  const r = process.platform === "win32"
    ? spawnSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-xf", zip, "-C", dir], { stdio: "inherit" })
    : spawnSync("unzip", ["-q", "-o", zip, "-d", dir], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("Не удалось распаковать " + zip);
}
async function ensureTools() {
  mkdirSync(join(TOOLS, "dl"), { recursive: true });
  const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";
  // JDK 17
  const jdkRoot = join(TOOLS, "jdk");
  if (!existsSync(jdkRoot) || !readdirSync(jdkRoot).length) {
    const zip = join(TOOLS, "dl", "jdk17" + (os === "windows" ? ".zip" : ".tar.gz"));
    await download(`https://api.adoptium.net/v3/binary/latest/17/ga/${os}/x64/jdk/hotspot/normal/eclipse?project=jdk`, zip);
    if (os === "windows") unzip(zip, jdkRoot);
    else { mkdirSync(jdkRoot, { recursive: true }); spawnSync("tar", ["-xzf", zip, "-C", jdkRoot], { stdio: "inherit" }); }
  }
  const jdkPath = join(jdkRoot, readdirSync(jdkRoot)[0]);
  // Android command-line tools: распаковываем так, чтобы sdkmanager лежал в android_sdk/bin
  const sdk = join(TOOLS, "android_sdk");
  if (!existsSync(join(sdk, "bin"))) {
    const zip = join(TOOLS, "dl", "cmdline-tools.zip");
    await download(`https://dl.google.com/android/repository/commandlinetools-${os === "windows" ? "win" : os}-11076708_latest.zip`, zip);
    const tmp = join(TOOLS, "dl", "cmdline");
    rmSync(tmp, { recursive: true, force: true });
    unzip(zip, tmp);
    mkdirSync(sdk, { recursive: true });
    for (const f of readdirSync(join(tmp, "cmdline-tools"))) renameSync(join(tmp, "cmdline-tools", f), join(sdk, f));
  }
  // sdkmanager узнаёт уже установленные пакеты только из папки cmdline-tools/latest — иначе ставит их
  // при каждом запуске заново в копии android-36-2, -3… (а Gradle от дубликатов не находит платформу)
  const latest = join(sdk, "cmdline-tools", "latest");
  if (!existsSync(join(latest, "bin"))) {
    mkdirSync(latest, { recursive: true });
    for (const f of ["bin", "lib", "source.properties", "NOTICE.txt"]) if (existsSync(join(sdk, f))) cpSync(join(sdk, f), join(latest, f), { recursive: true });
  }
  // source.properties в корне SDK заставляет Gradle считать весь SDK одним «старым пакетом»:
  // он не видит платформы и build-tools внутри («Failed to find target android-36»). Копия уже лежит в latest.
  if (existsSync(join(sdk, "source.properties"))) renameSync(join(sdk, "source.properties"), join(sdk, "cmdline-tools", "root-source.properties"));
  for (const group of ["platforms", "build-tools"]) {
    const dir = join(sdk, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const base = name.replace(/-\d+$/, "");
      if (base !== name && existsSync(join(dir, base, "package.xml"))) rmSync(join(dir, name), { recursive: true, force: true });
    }
  }
  return { jdkPath, sdk };
}

function sdkmanager(sdk, jdkPath, args) {
  const bin = join(sdk, "cmdline-tools", "latest", "bin", process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager");
  const all = [...args, `--sdk_root=${sdk}`];
  const opts = { stdio: "inherit", env: { ...process.env, JAVA_HOME: jdkPath, ANDROID_HOME: sdk } };
  const r = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${[bin, ...all].map(a => `"${a}"`).join(" ")}"`], { ...opts, windowsVerbatimArguments: true })
    : spawnSync(bin, all, opts);
  if (r.status !== 0) throw new Error("sdkmanager завершился с ошибкой");
}

// ---------- Сборка ----------
const { jdkPath, sdk } = await ensureTools();
log.info("Лицензия Android SDK: прочитайте условия и подтвердите (y), если согласны.");
sdkmanager(sdk, jdkPath, ["--licenses"]);
// Ставим только недостающее: повторная установка кладёт копию рядом (android-36-2…), и Gradle путается
const missing = [["build-tools;34.0.0", "build-tools/34.0.0"], ["platforms;android-36", "platforms/android-36"]]
  .filter(([, dir]) => !existsSync(join(sdk, dir, "package.xml"))).map(([pkg]) => pkg);
if (missing.length) sdkmanager(sdk, jdkPath, ["--install", ...missing]);

const config = new Config(jdkPath, sdk);
const jdkHelper = new JdkHelper(process, config);
const androidSdkTools = await AndroidSdkTools.create(process, config, jdkHelper, log);

// Ключ подписи — один раз; пароли храним рядом (файл не публикуется сервером и не попадает в git)
mkdirSync(OUT, { recursive: true });
const keystore = join(OUT, "safar.keystore");
const signingFile = join(OUT, "signing.json");
const signing = existsSync(signingFile) ? JSON.parse(readFileSync(signingFile, "utf8"))
  : { alias: "safar", password: randomBytes(18).toString("base64url"), keypassword: "" };
signing.keypassword ||= signing.password;
const keyTool = new KeyTool(jdkHelper, log);
if (!existsSync(keystore)) {
  await keyTool.createSigningKey({ path: keystore, alias: signing.alias, password: signing.password, keypassword: signing.keypassword,
    fullName: "Safar", organizationalUnit: "Safar", organization: "Safar", country: "UZ" });
  writeFileSync(signingFile, JSON.stringify(signing, null, 2));
  log.info("Создан ключ подписи android/safar.keystore — сохраните его и android/signing.json в надёжном месте.");
}

// Манифест и иконки отдаём с временного локального сервера (туннели вроде ngrok подменяют ответы
// страницей-предупреждением, а основной сервер может быть не запущен); в приложение встраиваем публичный адрес
const files = { "/manifest.webmanifest": "application/manifest+json", "/icons/icon-512.png": "image/png", "/icons/icon-maskable-512.png": "image/png" };
const tmpServer = createServer((req, res) => {
  const type = files[req.url];
  if (!type) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": type });
  res.end(readFileSync(join(ROOT, req.url)));
});
await new Promise(ok => tmpServer.listen(0, "127.0.0.1", ok));
const LOCAL = `http://127.0.0.1:${tmpServer.address().port}`;
const webManifest = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));
const twa = TwaManifest.fromWebManifestJson(new URL(`${PUBLIC}/manifest.webmanifest`), webManifest);
twa.packageId = PACKAGE_ID;
twa.name = "Safar";
twa.launcherName = "Safar";
twa.iconUrl = `${LOCAL}/icons/icon-512.png`;
twa.maskableIconUrl = `${LOCAL}/icons/icon-maskable-512.png`;
twa.monochromeIconUrl = undefined;
twa.webManifestUrl = new URL(`${LOCAL}/manifest.webmanifest`);   // генератор скачивает манифест ещё раз — тоже локально
twa.enableNotifications = false;
twa.signingKey = { path: keystore, alias: signing.alias };
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
twa.appVersionName = pkg.version || "1.0.0";
twa.appVersionCode = Math.floor(Date.now() / 60000);   // всегда растёт — новая сборка ставится поверх старой

const problem = twa.validate();
if (problem) throw new Error("Манифест приложения: " + problem);

const project = join(OUT, "twa");
// Прошлый проект пересоздаём. Его файлы может держать фоновый демон Gradle — сначала останавливаем его
if (existsSync(join(project, process.platform === "win32" ? "gradlew.bat" : "gradlew"))) {
  const opts = { cwd: project, stdio: "ignore", env: androidSdkTools.getEnv() };
  if (process.platform === "win32") spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${join(project, "gradlew.bat")}" --stop"`], { ...opts, windowsVerbatimArguments: true });
  else spawnSync(join(project, "gradlew"), ["--stop"], opts);
}
try {
  rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
} catch (e) {
  console.error(`Не удалось очистить ${project}: папку держит другая программа (открытый терминал, проводник или редактор). Закройте её и запустите снова.`);
  throw e;
}
await new TwaGenerator().createTwaProject(project, twa, log);
const appGradlePath = join(project, "app", "build.gradle");
let appGradle = readFileSync(appGradlePath, "utf8");
const dependenciesBlock = appGradle.lastIndexOf("dependencies {");
if (dependenciesBlock < 0) throw new Error("Не найден блок dependencies в Android-проекте Bubblewrap");
const dependencyLine = "        implementation 'com.google.mlkit:translate:17.0.3'";
if (!appGradle.includes(dependencyLine)) {
  const helperDependency = "implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.6.2'";
  if (!appGradle.includes(helperDependency)) throw new Error("Не найдена зависимость Android Browser Helper");
  appGradle = appGradle.replace(helperDependency, `${helperDependency}\n${dependencyLine}`);
}
const androidBlock = "android {";
if (!appGradle.includes(androidBlock)) throw new Error("Не найден блок android в Android-проекте Bubblewrap");
if (!appGradle.includes("rootProject.projectDir}/../native")) {
  appGradle = appGradle.replace(androidBlock, `${androidBlock}\n    sourceSets { main.java.srcDirs += "\${rootProject.projectDir}/../native" }`);
}
writeFileSync(appGradlePath, appGradle);

const manifestPath = join(project, "app", "src", "main", "AndroidManifest.xml");
let appManifest = readFileSync(manifestPath, "utf8");
const missingPermissions = [
  "android.permission.INTERNET",
  "android.permission.RECORD_AUDIO"
].filter(permission => !appManifest.includes(permission));
if (missingPermissions.length || !appManifest.includes("android.hardware.microphone")) {
  const appTag = appManifest.indexOf("<application");
  if (appTag < 0) throw new Error("Не найден application в AndroidManifest.xml");
  const permissions = missingPermissions.map(permission => `    <uses-permission android:name="${permission}" />`).join("\n");
  const microphone = appManifest.includes("android.hardware.microphone")
    ? "" : '\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />';
  appManifest = appManifest.slice(0, appTag) + permissions + microphone + "\n\n" + appManifest.slice(appTag);
}
const voiceActivity = `<activity android:name=".VoiceTranslateActivity" android:exported="true" android:label="Safar — голосовой перевод" android:theme="@android:style/Theme.Material.Light.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="safar" android:host="voice-translate" />
            </intent-filter>
        </activity>
`;
const translatorInitializer = `<provider android:name=".OfflineTranslatorInitializer" android:authorities="\${applicationId}.offline-translator-init" android:exported="false" android:initOrder="100" />
`;
if (!appManifest.includes('android:name=".VoiceTranslateActivity"')) {
  const closeApplication = appManifest.lastIndexOf("</application>");
  if (closeApplication < 0) throw new Error("Не найден конец application в AndroidManifest.xml");
  appManifest = appManifest.slice(0, closeApplication) + voiceActivity + appManifest.slice(closeApplication);
}
if (!appManifest.includes('android:name=".OfflineTranslatorInitializer"')) {
  const closeApplication = appManifest.lastIndexOf("</application>");
  if (closeApplication < 0) throw new Error("Не найден конец application в AndroidManifest.xml");
  appManifest = appManifest.slice(0, closeApplication) + translatorInitializer + appManifest.slice(closeApplication);
}
writeFileSync(manifestPath, appManifest);
tmpServer.closeAllConnections();
tmpServer.close();
await twa.saveToFile(join(project, "twa-manifest.json"));

log.info("Собираю APK (первый раз Gradle скачает свои зависимости — это несколько минут)…");
// Gradle запускаем по полному пути: Bubblewrap вызывает просто «gradlew.bat», а при переменной
// NoDefaultCurrentDirectoryInExePath Windows не ищет программы в текущей папке
{
  const gradlew = join(project, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  const opts = { cwd: project, stdio: "inherit", env: androidSdkTools.getEnv() };
  const r = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${gradlew}" assembleRelease --stacktrace"`], { ...opts, windowsVerbatimArguments: true })
    : spawnSync(gradlew, ["assembleRelease", "--stacktrace"], opts);
  if (r.status !== 0) throw new Error("Gradle: сборка не удалась (подробности выше)");
}
const unsigned = join(project, "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk");
const aligned = join(project, "app-release-aligned.apk");
await androidSdkTools.zipalign(unsigned, aligned);
await androidSdkTools.apksigner(keystore, signing.password, signing.alias, signing.keypassword, aligned, join(OUT, "safar.apk"));

// Связь сайта с приложением: по отпечатку ключа Android убирает адресную строку
const info = await keyTool.keyInfo({ path: keystore, alias: signing.alias, password: signing.password, keypassword: signing.keypassword });
const sha256 = info.fingerprints.get("SHA256");
writeFileSync(join(OUT, "assetlinks.json"), DigitalAssetLinks.generateAssetLinks(PACKAGE_ID, sha256));

log.info(`Готово: android/safar.apk (адрес ${PUBLIC}). Перезапустите сервер — кнопка «Скачать приложение» появится на Android.`);
process.exit(0);   // фоновые соединения сборщика не должны держать терминал
