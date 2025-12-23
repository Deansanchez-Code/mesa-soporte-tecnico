# Guía Paso a Paso: Copia de Seguridad Local (Opción 2)

Esta guía te ayudará a configurar y ejecutar el script para realizar copias de seguridad de tu base de datos Supabase en tu computadora local.

## Prerrequisitos

Para que el script funcione, necesitas tener instalada la herramienta `pg_dump`.

### Paso 1: Instalar Herramientas de PostgreSQL

Dado que el comando `pg_dump` no fue encontrado en tu sistema, debes instalarlo:

1.  Descarga el instalador de **PostgreSQL 16** (o la versión más reciente) para Windows desde aquí:
    [Descargar PostgreSQL](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2.  Ejecuta el instalador.
3.  **IMPORTANTE:** Durante la instalación, cuando llegues a la selección de componentes, **puedes desmarcar todo EXCEPTO "Command Line Tools"**. No necesitas instalar el servidor completo si solo quieres hacer backups.
4.  Finaliza la instalación.
5.  **Agregar al PATH (Si es necesario):**
    - Si después de instalar, el comando sigue sin funcionar, asegúrate de que la carpeta `bin` de Postgres (ej. `C:\Program Files\PostgreSQL\16\bin`) esté en tus Variables de Entorno (PATH).

### Paso 2: Configurar la Conexión

1.  Abre el archivo `.env` en la raíz de tu proyecto (`d:\mesa-soporte-tecnico\.env`).
2.  Asegúrate de tener una variable llamada `POSTGRES_URL_NON_POOLING` o `DATABASE_URL`.
    - Debe verse algo así: `postgres://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres`
    - Puedes obtenerla en tu panel de Supabase -> Settings -> Database -> Connection String (Nodejs).

### Paso 3: Ejecutar el Script

1.  Abre una terminal de PowerShell en la carpeta del proyecto.
2.  Ejecuta el siguiente comando:
    ```powershell
    .\scripts\backup_db.ps1
    ```
3.  Si es la primera vez que ejecutas scripts, es posible que debas permitir la ejecución:
    ```powershell
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\scripts\backup_db.ps1
    ```

### Resultado

- Si todo sale bien, verás un mensaje verde indicando "Backup Successful".
- El archivo `.sql` se guardará automáticamente en la carpeta `d:\mesa-soporte-tecnico\backups\`.
