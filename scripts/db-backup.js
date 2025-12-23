/* eslint-disable @typescript-eslint/no-var-requires */
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PROJECT_ID = "ukoqpikpqzffqieomaoo";
const DATE = new Date().toISOString().split("T")[0];
const OUTPUT_DIR = path.join(__dirname, "../database/dumps");
const OUTPUT_FILE = path.join(OUTPUT_DIR, `backup_${DATE}.sql`);

const BIN_DIR = path.join(__dirname, "bin");
const EXT = os.platform() === "win32" ? ".exe" : "";
const SUPABASE_BIN = path.join(BIN_DIR, `supabase${EXT}`);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`📦 Iniciando respaldo de base de datos...`);

if (!fs.existsSync(SUPABASE_BIN)) {
  console.error(`❌ No se encontró el binario de Supabase en: ${SUPABASE_BIN}`);
  process.exit(1);
}

// Usamos --linked por defecto ya que --project-id no es soportado en db dump directo sin link
const command = `"${SUPABASE_BIN}" db dump --linked > "${OUTPUT_FILE}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error al ejecutar el backup.`);

    const errString = (stderr || error.message || "").toString();

    // Check if error is due to missing link
    if (
      errString.includes("project not linked") ||
      errString.includes("must be linked")
    ) {
      console.error(
        `\n⚠️  ATENCIÓN: El proyecto no está vinculado localmente.`
      );
      console.error(
        `👉 Para que el backup funcione, debes vincular el proyecto una sola vez.`
      );
      console.error(
        `   Ejecuta esto en tu terminal y escribe la contraseña de tu base de datos:`
      );
      console.error(
        `\n   scripts\\bin\\supabase.exe link --project-ref ${PROJECT_ID}\n`
      );
    }
    // Check for Docker errors
    else if (
      errString.includes("docker") ||
      errString.includes("connection refused") ||
      errString.includes("pipe")
    ) {
      console.error(`\n⚠️  ERROR DE DOCKER DETECTADO`);
      console.error(
        `   El comando 'supabase db dump' utiliza Docker para garantizar la compatibilidad.`
      );
      console.error(
        `   Parece que Docker Desktop no está ejecutándose o no está instalado.`
      );
      console.error(`\n   SOLUCIÓN:`);
      console.error(
        `   1. Abre Docker Desktop y espera a que el motor arranque.`
      );
      console.error(
        `   2. Si no lo tienes, instálalo desde: https://docs.docker.com/desktop/install/windows-install/`
      );
      console.error(`   3. Vuelve a ejecutar este comando.`);
    } else {
      console.error(`Error Detallado: ${errString}`);
    }
    process.exit(1);
  }

  // Filter out noise logs from stderr if it succeeds (supabase cli is verbose on stderr)
  if (stderr && !stderr.includes("Dumped schema")) {
    const usefulLogs = stderr
      .split("\n")
      .filter(
        (l) => !l.includes("Initialising") && !l.includes("Dumping schemas")
      )
      .join("\n");
    if (usefulLogs.trim()) console.log(`ℹ️ Info: ${usefulLogs}`);
  }
  console.log(`✅ Respaldo completado exitosamente: ${OUTPUT_FILE}`);
});
