/* eslint-disable */
// @ts-nocheck
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PROJECT_ID = "ukoqpikpqzffqieomaoo";
const OUTPUT_FILE = path.join(__dirname, "../src/types/supabase.ts");

const BIN_DIR = path.join(__dirname, "bin");
const EXT = os.platform() === "win32" ? ".exe" : "";
const SUPABASE_BIN = path.join(BIN_DIR, `supabase${EXT}`);

console.log(
  `🔄 Iniciando sincronización de tipos para el proyecto: ${PROJECT_ID}`,
);

if (!fs.existsSync(SUPABASE_BIN)) {
  console.error(`❌ No se encontró el binario de Supabase en: ${SUPABASE_BIN}`);
  console.error(`👉 Ejecuta: node scripts/setup-supabase.js para instalarlo.`);
  process.exit(1);
}

const command = `"${SUPABASE_BIN}" gen types typescript --project-id "${PROJECT_ID}" > "${OUTPUT_FILE}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error al sincronizar tipos: ${error.message}`);
    console.error(
      `👉 Asegúrate de estar logueado. Ejecuta manualmente en tu terminal:`,
    );
    console.error(`   "${SUPABASE_BIN}" login`);
    process.exit(1);
  }
  if (stderr) {
    console.log(`ℹ️ Info: ${stderr}`);
  }
  console.log(`✅ Tipos sincronizados exitosamente: ${OUTPUT_FILE}`);
});
