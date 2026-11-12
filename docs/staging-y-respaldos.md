# Fase 1: staging y recuperación

Para trabajar sin consumir almacenamiento remoto adicional, usar [la guía local](pruebas-locales.md). El procedimiento de esta página corresponde al staging remoto opcional.

Estado: preparación local. Este cambio no crea recursos, no hace respaldos y no despliega.
Producción conserva su configuración actual. La fase 2 debe retirar y rotar sus secretos expuestos.

## Recursos separados

| Uso | Worker | Neon | R2 |
| --- | --- | --- | --- |
| Producción existente | `kurumanga` | Proyecto actual | `db-mangas` |
| Pruebas | `kurumanga-staging` | Proyecto nuevo `kuramanga-staging` | `db-mangas-staging` |
| Respaldo | Sin Worker con permisos de escritura | Archivo pg_dump independiente | `kuramanga-backups` privado |

Preferimos un proyecto Neon separado y una restauración de esquema, para no copiar usuarios reales ni compartir credenciales. Una rama Neon también aísla los datos, pero no debe usarse con las credenciales heredadas de producción: requiere rol y contraseña propios. Una rama mutable de pruebas no sustituye un respaldo independiente.

## 1. Registrar el punto de recuperación

Antes de cambiar producción:

1. Cloudflare > Workers & Pages > `kurumanga` > Deployments: registrar versión activa, fecha, configuración y bindings. Conservar el código/commit que produjo esa versión y los artefactos disponibles. No asumir que el checkout actual coincide con lo desplegado.
2. Registrar versión PostgreSQL (`SHOW server_version;` desde SQL Editor), región Neon y ventana de restauración disponible en el plan. Revisar la protección de la rama de producción si el plan la ofrece.
3. Usar Node.js 24 LTS para los scripts y pruebas (versión local comprobada: 24.16.0). Instalar herramientas cliente PostgreSQL de versión mayor igual a la del servidor y rclone. No están disponibles en el PATH de la sesión revisada.
4. No cambiar el pipeline del Worker existente. Si conectas Git, staging debe tener su propio Worker y comandos de build/deploy.

Un rollback de Worker no restaura PostgreSQL ni imágenes. Mantener ambos respaldos con un identificador común.

## 2. Respaldar Neon sin modificar producción

En Neon > proyecto actual > Connect, elegir conexión **directa**, sin `-pooler`, y anotar host, base y usuario. No pegar contraseñas en comandos, Git ni este documento.

En PowerShell, sustituir los marcadores:

```powershell
New-Item -ItemType Directory -Force -Path backups
$backupId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$dumpPath = Join-Path (Resolve-Path backups) "neon-$backupId.dump"
$env:PGSSLMODE = 'require'
pg_dump --host HOST_PRODUCCION_DIRECTO --username USUARIO_PRODUCCION --dbname BASE_PRODUCCION --password --format=custom --no-owner --no-acl --file $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'Falló pg_dump; no continuar.' }
pg_restore --list $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'El archivo no pudo leerse.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath
```

`--password` solicita la contraseña de forma interactiva. pg_dump obtiene una instantánea consistente de esa base, pero no incluye los objetos R2 ni constituye un respaldo de toda la cuenta/roles globales. Guarda el SHA256 y el identificador junto al respaldo.

La carpeta `backups/` está ignorada por Git, pero este proyecto está en OneDrive: ignorar Git no impide sincronización. Para datos reales, utiliza preferentemente una carpeta local cifrada fuera de OneDrive. El dump contiene hashes, sesiones y datos personales.

## 3. Respaldar R2 y almacenar el dump

En Cloudflare > R2, crear `kuramanga-backups`, sin URL pública ni dominio público. No agregarlo como binding al Worker.

Crear credenciales S3 específicas con acceso a buckets seleccionados:

- `r2-prod-read`: lectura de objetos de `db-mangas` exclusivamente.
- `r2-backup`: lectura/escritura de `kuramanga-backups` exclusivamente.
- `r2-stage`: lectura/escritura de `db-mangas-staging` exclusivamente.

Estos son nombres de remotes locales de rclone. Configurarlos con `rclone config`: Storage `s3`, provider `Cloudflare`, endpoint S3 mostrado por Cloudflare (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`), credenciales correspondientes. Guardar la configuración fuera del repo y protegerla; no subirla a Git.

Para el dump, crear además un remote rclone de tipo `crypt`, llamado `r2-backup-crypt`, que apunte a `r2-backup:kuramanga-backups/neon-encrypted`. Conservar su contraseña y salt en un gestor de contraseñas independiente; sin ellos no se puede restaurar.

En la misma sesión PowerShell del respaldo:

```powershell
rclone copy r2-prod-read:db-mangas "r2-backup:kuramanga-backups/r2/$backupId" --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Falló la simulación R2.' }
rclone copy r2-prod-read:db-mangas "r2-backup:kuramanga-backups/r2/$backupId" --progress
if ($LASTEXITCODE -ne 0) { throw 'Falló la copia R2.' }
rclone check r2-prod-read:db-mangas "r2-backup:kuramanga-backups/r2/$backupId" --one-way --download
if ($LASTEXITCODE -ne 0) { throw 'La copia R2 no coincide.' }
rclone copyto $dumpPath "r2-backup-crypt:neon-$backupId.dump"
if ($LASTEXITCODE -ne 0) { throw 'Falló la subida del dump cifrado.' }
```

La comprobación con `--download` consume tiempo y lecturas, pero verifica contenido sin depender de ETags multipart. Usar un prefijo distinto en cada respaldo. Las copias R2 no son una instantánea atómica del bucket: para el primer respaldo coordinado, detener temporalmente subidas, ediciones y borrados de contenido por medios operativos, copiar R2, generar el dump y verificar que todas las URLs del dump tienen objeto respaldado antes de reanudar. El código actual no implementa modo mantenimiento.

Configurar una regla de retención del bucket de respaldo, por ejemplo 30 días, y un ciclo de vida posterior a esa retención según espacio/coste. Revisar coste antes de ejecutar una copia grande. Mantener también una copia cifrada fuera de la misma cuenta para recuperación ante pérdida de acceso. No hay automatización de respaldos incluida aún.

## 4. Comprobar una restauración real

Crear un proyecto Neon temporal **vacío**, por ejemplo `kuramanga-restore-drill`, que ningún Worker use. Obtener su conexión directa. Nunca ejecutar esta operación contra producción.

Si se descargó desde R2, recuperar el archivo con `rclone copyto r2-backup-crypt:neon-ID.dump backups/restore-ID.dump` y comprobar que su SHA256 coincide con el original.

```powershell
pg_restore --host HOST_RESTORE_DIRECTO --username USUARIO_RESTORE --dbname BASE_RESTORE --password --no-owner --no-acl --exit-on-error $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'Restauración incompleta.' }
```

Desde SQL Editor del proyecto temporal comparar con producción las tablas, funciones, índices y conteos de todas las tablas. Examinar una muestra de mangas, capítulos, usuarios y comentarios. Registrar hora, resultado, SHA256 y proyecto destino. `pg_restore --list` por sí solo NO verifica una restauración.

Para probar imágenes sin escribir en producción:

```powershell
rclone copy "r2-backup:kuramanga-backups/r2/$backupId" r2-stage:db-mangas-staging --dry-run
rclone copy "r2-backup:kuramanga-backups/r2/$backupId" r2-stage:db-mangas-staging --progress
rclone check "r2-backup:kuramanga-backups/r2/$backupId" r2-stage:db-mangas-staging --one-way --download
```

Comprobar cada código de salida antes del siguiente comando. Para probar un catálogo restaurado con el Worker, sus URLs guardadas en columnas y arrays JSONB deben reemplazarse por la URL de staging **solo en la base restaurada**, con un script específico tras inspeccionar el esquema real. Copiar objetos no cambia las URLs de PostgreSQL. No conectar aún un dump con usuarios/sesiones reales a un Worker público; requiere sanitización y eliminación de sesiones.

## 5. Crear staging limpio

1. Neon: crear proyecto `kuramanga-staging` con credenciales nuevas, sin reutilizar la contraseña de producción. Elegir región apropiada. Para arrancar con estructura conocida, restaurar **solo esquema** del dump en su base vacía:

   ```powershell
   pg_restore --host HOST_STAGING_DIRECTO --username USUARIO_STAGING --dbname BASE_STAGING --password --schema-only --no-owner --no-acl --exit-on-error $dumpPath
   ```

   Comprobar salida. No ejecutar `db/schema.sql`: difiere del esquema que usa la aplicación actual. El SQL heredado de inicialización en peticiones sigue pendiente de la fase 4; staging debe usar recursos desechables.
2. R2: crear `db-mangas-staging`. Habilitar su URL pública de desarrollo para las imágenes y copiarla. Para uso prolongado, configurar un dominio de pruebas; `r2.dev` no es el destino de producción. El bucket de respaldos permanece privado.
3. Cloudflare: crear Worker `kurumanga-staging`, inicialmente con código de ejemplo, sin rutas/domino de producción ni Hyperdrive. Activar protección con Cloudflare Access y permitir solo tus identidades antes de desplegar la app. Si no puedes proteger workers.dev, usar un dominio de staging protegido y desactivar acceso público alternativo. No exponer la base vacía con registro abierto: el comportamiento de primera cuenta administradora aún es heredado.
4. Copiar la URL exacta del Worker. En `wrangler.staging.json`, sustituir los tres marcadores: host Neon (sin protocolo, puerto ni ruta), URL pública R2 y URL Worker.
5. Worker staging > Settings > Variables and Secrets: agregar `DATABASE_URL` como **Secret**, con la conexión del proyecto staging. El hostname debe coincidir exactamente con `STAGING_DATABASE_HOST`; si eliges pooler, usar el hostname pooler en ambos. No se requiere Hyperdrive para esta fase.

Alternativamente, después de crear el Worker:

```powershell
npx wrangler secret put DATABASE_URL --config wrangler.staging.json
```

El prompt recibe la conexión, sin escribirla en el comando. No añadir claves S3 al Worker staging: usa el binding nativo R2.

El nombre del bucket declarado no demuestra por sí solo qué bucket está enlazado: comprobar el binding real `R2_BUCKET` en el dashboard después del despliegue.

## 6. Validar y desplegar únicamente staging

Retirar temporalmente del directorio del proyecto los `.env*` y `.dev.vars*` privados (mantener `.env.example`), guardándolos de forma segura fuera del repo. El script los rechaza para evitar que OpenNext empaquete variables de producción. El script tampoco reutiliza un artefacto ya compilado: `deploy:staging` siempre reconstruye.

```powershell
npm run test:staging-config
npm run check:staging
npm run build:staging
```

El último comando no publica. Para publicar tras revisar el resultado:

```powershell
npm run deploy:staging
```

`preview:staging` reconstruye y abre el emulador local de Workers. No equivale al Worker remoto: el secret remoto no se descarga y R2 se emula localmente. Para el ensayo integrado usar el Worker remoto protegido; no copiar credenciales de producción para resolver una conexión del emulador.

Los comandos existentes `build` y `build:next` mantienen su comportamiento. No usar el artefacto de `build:staging` con la configuración de producción; el build incluye URL, exclusión de anuncios y cabeceras propias de staging.

El script comprueba configuración; no verifica permisos de cuenta ni existencia de recursos. No se han medido aún costes o límites del plan. El soporte de la versión instalada de Next/OpenNext debe confirmarse con el build; no omitir bloqueos de compatibilidad con flags peligrosos.

## 7. Criterios para cerrar la fase

- [ ] Versión activa de producción identificada y procedimiento de rollback registrado.
- [ ] Dump completado, SHA256 conservado y copia cifrada guardada en R2.
- [ ] Copia R2 contrastada con el origen y objetos referenciados comprobados.
- [ ] Restauración en proyecto temporal comprobada (no solo listado del dump).
- [ ] Worker staging protegido con Access antes de habilitar la app.
- [ ] Secrets, host Neon y binding R2 inspeccionados en el dashboard.
- [ ] Registro de una cuenta de prueba y subida de una imagen aparecen solo en staging. Ninguna tabla/objeto correspondiente aparece en producción.
- [ ] `robots.txt` bloquea rastreo, sitemap vacío y respuestas con `X-Robots-Tag: noindex, nofollow, noarchive`.
- [ ] Acceso sin autorización de Access bloqueado. Noindex no es control de acceso.
- [ ] Inicio/cierre de sesión y lectura de un capítulo de prueba funcionan.

Hasta completar esta lista, la fase está preparada pero no validada operativamente.

## Referencias verificadas

- OpenNext CLI y configuración alternativa: https://opennext.js.org/cloudflare/cli
- Advertencia sobre archivos de entorno durante build: https://opennext.js.org/cloudflare/howtos/dev-deploy
- Neon pg_dump/pg_restore: https://neon.com/docs/manage/backup-pg-dump
- Neon branches: https://neon.com/docs/manage/branches
- Cloudflare secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare R2 con rclone: https://developers.cloudflare.com/r2/examples/rclone/
- Retención R2: https://developers.cloudflare.com/r2/buckets/bucket-locks/
