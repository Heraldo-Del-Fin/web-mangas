# Pruebas locales con PostgreSQL y R2 simulado

No necesitas crear proyectos Neon, buckets ni Workers remotos. Producción mantiene sus recursos actuales. Requisitos: Node.js 24 LTS, dependencias instaladas y PostgreSQL local en ejecución.

## 1. Crear la base en pgAdmin

1. Abre pgAdmin y conecta tu servidor PostgreSQL local (normalmente localhost:5432).
2. En Databases, clic derecho > Create > Database.
3. Nombre obligatorio: `kuramanga_test`.
4. Selecciona tu usuario local como propietario y guarda.

Usa una base vacía y exclusiva de pruebas. La aplicación crea sus tablas y función de sincronización en la primera lectura. Este entorno aún utiliza la persistencia heredada, pendiente de la fase 4; no es adecuado para datos irremplazables. El modo local evita el DROP de la tabla heredada, no ejecuta el endpoint HTTP Neon ni usa Hyperdrive y no utiliza el fallback JSON.

## 2. Configurar credenciales locales

```powershell
npm run setup:local
```

Editar `config/local/.env.local`:

```dotenv
LOCAL_DATABASE_URL=postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/kuramanga_test
```

- Sustituye usuario, contraseña y puerto según tu instalación.
- Los caracteres especiales de usuario/contraseña deben codificarse como componentes URL: `@` → `%40`, `#` → `%23`, `%` → `%25`, `:` → `%3A`.
- No pegues contraseñas en el chat. Este archivo está ignorado por Git.
- Si el proyecto está en OneDrive, ignorar Git no evita sincronización de secretos/estado: aplica la política de almacenamiento privado que corresponda.
- Mantén los archivos de producción separados. El launcher fija APP_ENV, DATABASE_URL, URL del sitio y variables R2 locales; `.env.local` de la raíz no se modifica. El contexto Cloudflare se crea con la configuración local en `config/local/`, no con `wrangler.jsonc`.
- `config/local/.dev.vars` se genera automáticamente con la conexión local para el emulador. No se necesita rellenarlo manualmente.
- Solo se permite loopback y la base `kuramanga_test`. No se aceptan parámetros que cambien el host de conexión.

## 3. Comprobar PostgreSQL

```powershell
npm run check:local
```

Debe mostrar `PostgreSQL local OK: kuramanga_test (127.0.0.1).` (o IPv6 `::1`). No modifica tablas. Si falla:

- `ECONNREFUSED`: inicia tu servidor PostgreSQL y revisa puerto.
- Error de contraseña: corrige usuario/contraseña en el archivo privado.
- Base inexistente: crea `kuramanga_test` en el paso 1.
- Error de aislamiento: usa loopback y el nombre obligatorio, no un host Neon ni la base `postgres`.

## 4. Iniciar la aplicación

```powershell
npm run dev:local
```

`npm run dev` también utiliza este launcher local para evitar que un arranque habitual termine conectando a producción.

Abrir **http://127.0.0.1:3000**. Usa siempre esa dirección para evitar confusión de cookies con localhost u otros servidores. El launcher escucha solo en loopback.

En este modo:

- Next ejecuta la aplicación y `pg` conecta a PostgreSQL local.
- OpenNext/Miniflare simulan el binding R2; los objetos se guardan en `.wrangler/local-test/`.
- `/api/local-assets/...` sirve esas imágenes. Esa ruta devuelve 404 fuera del modo local-test.
- No se usan claves S3 de producción y no hay fallback hacia R2 remoto si el emulador falla.
- Se omiten anuncios y se bloquea indexación.

El diagnóstico http://127.0.0.1:3000/api/db-status debe mostrar driver `local-pg`, host loopback y bucket `kuramanga-local-test`. La primera lectura puede inicializar el esquema local.

Registra una cuenta ficticia: por el comportamiento actual, la primera es administradora. Crea una obra, sube una portada y un capítulo y comprueba que se leen. Detén el servidor con Ctrl+C antes de iniciar otro o copiar el estado R2.

Con el servidor activo, desde otra terminal puedes ejecutar `npm run test:local-smoke`. Comprueba PostgreSQL/R2, rechaza una subida sin sesión y prueba una subida con una sesión temporal. Elimina su usuario y sesión al finalizar; deja una diminuta imagen de prueba en el R2 simulado. No sustituye las pruebas manuales de registro/login, edición y lectura de capítulos.

## 5. Probar el artefacto Worker

```powershell
npm run test:local-config
npm run test:staging-config
npm run build:local
```

`build:local` compila con Next/OpenNext y la configuración local, sin desplegar. Para reconstruir y ejecutar el Worker en el runtime local:

```powershell
npm run preview:local
```

Abre la misma dirección http://127.0.0.1:3000. No ejecutes `dev:local` y `preview:local` simultáneamente: comparten puerto y estado R2. El build local puede sobrescribir `.next` y `.open-next`; antes de un despliegue de producción debes volver a compilar para producción. No desplegar el artefacto local con el wrangler de producción.

OpenNext puede mostrar advertencias de compatibilidad de Windows/versiones; si el build se bloquea, no omitir el bloqueo con flags peligrosos. El modo Next dev permite probar funcionalidades, pero no reemplaza la comprobación del artefacto Worker.

La configuración local empaqueta `pg`, utiliza explícitamente el socket TCP de Node y reduce a uno los procesos de prerender. Son ajustes limitados a pruebas locales para evitar los fallos de symlinks y concurrencia observados en Windows; producción conserva su configuración de compilación.

Verificación realizada con una instancia temporal PostgreSQL 18: build OpenNext completo, ocho pruebas de configuración y prueba integrada contra el Worker compilado aprobados. Al detener el emulador, el runtime emitió `Network connection lost`; ese mensaje apareció durante el cierre, después de completar las peticiones de prueba. Si aparece durante el uso normal, revisar la conexión PostgreSQL y los registros en lugar de ignorarlo. La instancia temporal se detuvo; tus credenciales y tu servidor habitual aún requieren configuración.

Los scripts locales no admiten `deploy`. La configuración local además deshabilita workers.dev, preview URLs y bindings remotos; esto no impide que alguien invoque Wrangler manualmente, por lo que no debe usarse para publicar.

## 6. Restaurar un respaldo Neon en tu PC (opcional)

Este paso es independiente del arranque limpio. Guarda el dump original aparte y restaura únicamente en una base de pruebas **vacía**, con el servidor de la app detenido.

En PowerShell, usando la instalación detectada (ajusta versión/ruta si corresponde):

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' `
  --host 127.0.0.1 --port 5432 `
  --username TU_USUARIO_LOCAL --dbname kuramanga_test `
  --password --no-owner --no-acl --exit-on-error `
  'C:\RespaldosKuraManga\neon.dump'
```

Revisa `$LASTEXITCODE`: debe ser 0. El rol dueño local debe poder operar las tablas y funciones restauradas. No usar `--clean` contra una base con datos que quieras conservar.

Un dump completo incluye cuentas y sesiones reales. Antes de usarlo para pruebas, borrar sesiones desde pgAdmin conectado a `kuramanga_test` y sanitizar los datos personales. Las contraseñas de cuentas restauradas siguen siendo las de producción si no se cambian; mantener estas pruebas solo en loopback.

Las imágenes y sus URLs son otro paso: el dump no contiene los archivos R2. Para un primer arranque utiliza datos nuevos. Para probar un catálogo restaurado completo hay que importar la copia de imágenes al R2 simulado y reemplazar URLs únicamente en la base local; ese importador no está incluido en este cambio. No afirmar que el catálogo restaurado funciona sin completar ese paso.

## 7. Respaldos locales

Para respaldar PostgreSQL local:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' `
  --host 127.0.0.1 --port 5432 `
  --username TU_USUARIO_LOCAL --dbname kuramanga_test `
  --password --format=custom --no-owner --no-acl `
  --file 'C:\RespaldosKuraManga\pruebas.dump'
```

Para respaldar los objetos simulados, detén el servidor y copia toda `.wrangler/local-test/` a otra carpeta. No editar sus archivos internos manualmente. Guarda dump y copia R2 con una misma fecha; al restaurar el estado de R2 usa la misma versión de herramientas.

Para descargar producción sin duplicar almacenamiento remoto: pg_dump desde Neon a tu disco y `rclone copy` desde R2 a una carpeta privada, con credenciales de solo lectura del bucket. Eso realiza lecturas remotas, pero no crea recursos ni almacenamiento remoto adicional. Conservar una segunda copia cifrada en disco externo.

## Referencias

- https://developers.cloudflare.com/workers/local-development/local-data/
- https://opennext.js.org/cloudflare/howtos/dev-deploy
- https://node-postgres.com/apis/client
