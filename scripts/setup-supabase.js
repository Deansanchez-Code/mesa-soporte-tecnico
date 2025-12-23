/* eslint-disable */
// @ts-nocheck
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const BIN_DIR = path.join(__dirname, "bin");
const DEST_FILE_ZIP = path.join(BIN_DIR, "supabase_download.zip");
const DEST_FILE_TAR = path.join(BIN_DIR, "supabase_download.tar.gz");
const EXE_NAME = process.platform === "win32" ? "supabase.exe" : "supabase";

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Node.js" } }, (res) => {
        let data = "";
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Request failed: ${res.statusCode}`));
        }
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const newUrl = response.headers.location;
        console.log(`➡️ Redirigiendo a: ${newUrl}`);
        return downloadFile(newUrl, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(
          new Error(
            `Falló descarga: ${response.statusCode} ${response.statusMessage}`,
          ),
        );
        return;
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    });

    req.on("error", reject);
  });
}

async function install() {
  try {
    console.log("🔍 Buscando última versión de Supabase CLI...");
    const release = await fetchJson(
      "https://api.github.com/repos/supabase/cli/releases/latest",
    );
    const version = release.tag_name;
    console.log(`✨ Última versión encontrada: ${version}`);

    const platform =
      process.platform === "win32" ? "windows" : process.platform;
    const arch =
      process.arch === "x64"
        ? "amd64"
        : process.arch === "arm64"
          ? "arm64"
          : "amd64";

    const assets = release.assets;
    let targetAsset = assets.find(
      (a) =>
        a.name.toLowerCase().includes(platform) &&
        (a.name.toLowerCase().includes(arch) ||
          (arch === "amd64" && a.name.toLowerCase().includes("x86_64"))) &&
        (a.name.endsWith(".zip") || a.name.endsWith(".tar.gz")),
    );

    if (!targetAsset) {
      console.error("❌ No se encontró un asset compatible.");
      return;
    }

    const downloadUrl = targetAsset.browser_download_url;
    console.log(`🔗 URL de descarga: ${downloadUrl}`);
    console.log(`📦 Archivo: ${targetAsset.name}`);

    const isZip = targetAsset.name.endsWith(".zip");
    const destFile = isZip ? DEST_FILE_ZIP : DEST_FILE_TAR;

    console.log(`⬇️ Descargando...`);
    await downloadFile(downloadUrl, destFile);

    console.log("✅ Descarga completada.");
    console.log("📦 Extrayendo...");

    try {
      if (isZip) {
        execSync(`tar -xf "${destFile}" -C "${BIN_DIR}"`);
      } else {
        execSync(`tar -xf "${destFile}" -C "${BIN_DIR}"`);
      }
      console.log(
        `✅ Supabase CLI instalado en: ${path.join(BIN_DIR, EXE_NAME)}`,
      );
      fs.unlinkSync(destFile);
    } catch (e) {
      console.error("❌ Error al extraer:", e.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

install();
