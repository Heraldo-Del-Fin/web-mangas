# Fase 2: credenciales y rotación de producción

Estado: código preparado; no se han cambiado contraseñas, secretos, Hyperdrive ni tokens remotos. Retirar valores del checkout no invalida los que ya fueron expuestos ni los elimina del historial Git.

## Cambios preparados

- `wrangler.jsonc` conserva nombres, bindings y valores públicos. Se retiraron DATABASE_URL y claves S3. La conexión local real de Hyperdrive se reemplazó por `postgresql://build:password@127.0.0.1:1/opennext_build`, un placeholder sin acceso real que permite iniciar el proxy de OpenNext durante build/deploy. No sustituye las credenciales de origen configuradas en Hyperdrive.
- `DATABASE_HOST` es información pública para comprobar aislamiento; no permite conectar y no reemplaza DATABASE_URL.
- La conexión predeterminada incrustada en `lib/neon-db.ts` se eliminó. DATABASE_URL debe proporcionarse explícitamente.
- Producción usa el binding nativo R2_BUCKET; no lee claves S3 ni cae a archivos locales si falla R2. No necesita emitir una nueva clave S3 para subir imágenes.
- Producción tampoco usa un JSON/base vacía como respaldo si PostgreSQL no está configurado o no responde. Así, retirar un secreto no aparenta dejar una instalación nueva disponible.
- Las pruebas locales siguen leyendo exclusivamente `config/local/.env.local` y usando PostgreSQL/R2 locales.
- Los builds del proyecto filtran el módulo de entornos generado por OpenNext: solo conservan NEXT_PUBLIC_SITE_URL y escanean el artefacto. Esto evita empaquetar las variables privadas que OpenNext puede copiar de `.env.local`. Tu archivo privado no se modifica. Las demás variables de ejecución deben proporcionarse mediante bindings/Secrets; no invocar directamente `opennextjs-cloudflare build` saltándose los scripts del proyecto.

## 1. Preparar antes del despliegue

1. Conservar respaldo verificado y versión activa según la fase 1.
2. En Cloudflare > Workers & Pages > `kurumanga` > Settings > Variables and Secrets, comprobar dónde está DATABASE_URL: actualmente puede ser una variable de texto o depender de la contraseña incrustada en el código viejo.
3. Registrar el rol Neon que utiliza, el nombre de la base, host y configuración Hyperdrive `bd-manga`. No pegar contraseñas en tickets o Git.
4. Conservar en un gestor privado la conexión vigente mientras se coordina el cambio. No crear un archivo versionado para guardar la contraseña antigua.
5. Revisar dónde más se usa el rol/tokens expuestos: Hyperdrive, CI, copias locales y respaldos. No revocar un token de otra integración sin identificarla.

No desplegar esta versión sin configurar primero el secreto DATABASE_URL y comprobar el binding R2_BUCKET al bucket de producción.

## 2. Pasar la conexión vigente a Secret

Desde el dashboard del Worker de producción, crear o convertir `DATABASE_URL` a tipo **Secret**, usando la conexión vigente. Si existe como variable de texto, gestionar el reemplazo en la misma actualización de configuración para no dejar dos bindings con el mismo nombre. El valor debe incluir usuario/contraseña y SSL; preferir copiarlo desde Connect de Neon.

La app usa Neon HTTP primero; el secreto debe apuntar al host Neon, no a localhost ni a la conexión interna de Hyperdrive. Se preserva `channel_binding=require` si está presente; el valor completo se envía al endpoint Neon.

También existe el comando interactivo (no poner el valor como argumento):

```powershell
npx wrangler secret put DATABASE_URL --config wrangler.jsonc
```

Ese comando puede crear un despliegue y puede requerir resolver previamente el conflicto con una variable de texto del mismo nombre. Para esta primera transición es preferible revisar el cambio en el dashboard. No ejecutarlo apuntando al Worker de staging.

Este paso protege el almacenamiento, pero **todavía no rota la contraseña expuesta**. `keep_vars` no convierte ni elimina variables antiguas por sí mismo.

## 3. Validar y desplegar el código preparado

En local, con tus credenciales PostgreSQL ya configuradas:

```powershell
npm run check:secrets
npm run test:secrets
npm run test:hyperdrive-proxy
npm run test:staging-config
npm run test:local-config
npm run build:local
npm run preview:local
```

En otra terminal, con preview activo:

```powershell
npm run test:local-smoke
```

El escaneo revisa archivos versionables y patrones concretos; no certifica que no exista ningún secreto ni revisa automáticamente historial/archivos ignorados. Después de validar, compilar de nuevo para producción desde un entorno de build que no cargue `.env.local` de pruebas ni `.dev.vars` locales. No publicar el artefacto local; contiene URL y comportamiento de pruebas. Los recursos de prueba continúan sin consumir almacenamiento remoto.

Si el deploy falla con `no local hyperdrive connection string`, confirmar que el placeholder local está en el binding `bd-manga`. OpenNext invoca `getPlatformProxy` antes de desplegar y Wrangler exige ese valor aun en CI. No instalar PostgreSQL en Cloudflare ni volver a poner la contraseña Neon en el archivo. El proxy se puede crear sin conectarse al puerto ficticio; la aplicación de pruebas usa otra configuración y su PostgreSQL real.

Desplegar la nueva versión con el procedimiento habitual de producción una vez preparado el Secret. Comprobar login, lectura y subida antes de revocar las claves S3. El binding R2_BUCKET funciona sin ellas.

## 4. Rotar Neon y actualizar Hyperdrive

La opción directa en esta fase es rotar la contraseña del rol existente, conservando la misma base y esquema. En Neon, abrir Roles y restablecer la contraseña del rol usado por la app. Guardar el nuevo valor en el gestor privado.

Inmediatamente después:

1. Actualizar el Secret DATABASE_URL del Worker con la nueva conexión.
2. Actualizar la contraseña de origen de Hyperdrive `bd-manga` desde Cloudflare > Hyperdrive, o crear una configuración sustituta con las credenciales nuevas y actualizar su binding si ese es el flujo disponible. Mantener host, base y usuario correctos.
3. Comprobar lecturas, login y escritura real, incluida una subida. Una respuesta del healthcheck por sí sola no prueba el fallback Hyperdrive.
4. Comprobar, con un cliente fuera de la app, que una **conexión nueva** con la contraseña antigua falla. Cambiar la contraseña no necesariamente termina conexiones ya autenticadas; valorar el cierre controlado de sesiones antiguas del rol una vez conectada la nueva versión.
5. Actualizar herramientas de respaldo e integraciones identificadas en el paso 1.

**Puede existir una ventana de fallo entre cambiar Neon y actualizar Worker/Hyperdrive.** Coordinarla como una intervención breve. No prometer cero interrupción con este flujo.

Una rotación con dos roles en paralelo requiere primero verificar permisos/propiedad de tablas y funciones: el código actual todavía ejecuta DDL y CREATE OR REPLACE de una función al iniciar. Un rol nuevo con solo SELECT/INSERT/UPDATE/DELETE no basta. Esa separación de roles se preparará con las migraciones de la fase 4; no otorgar permisos administrativos a ciegas para evitar el corte.

## 5. Revocar las claves R2 expuestas

Después de verificar que la nueva versión sube mediante R2_BUCKET:

1. Cloudflare > R2 > gestión de API tokens: identificar el token correspondiente a las claves expuestas.
2. Confirmar si lo utilizan rclone, backups u otras aplicaciones. Si necesitan acceso, generar primero credenciales nuevas limitadas al bucket y operaciones que requieran, guardadas fuera del repo.
3. Revocar el token expuesto.
4. Quitar del Worker las variables/secretos antiguos R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY. No se eliminan automáticamente al borrarlas del archivo si se preserva la configuración remota.
5. Volver a comprobar subida de portada y capítulo y confirmar que las credenciales antiguas ya no permiten acceder a R2.

No cambiar nombres de buckets ni eliminar objetos: la rotación de claves no requiere mover las imágenes existentes.

## 6. Historial, archivos y rollback

- Si estos secretos llegaron al repositorio remoto, tratarlos como expuestos aunque fuera privado. Rotarlos es obligatorio para invalidarlos.
- No se ha reescrito el historial Git: requiere coordinación con otras copias/ramas. Retirar secretos del historial no sustituye la revocación.
- Revisar `.env.local` de la raíz y otros archivos privados: si contienen contraseñas antiguas, actualizarlos o retirarlos del flujo operativo. No modificar la contraseña de PostgreSQL local por esta rotación.
- Los artefactos antiguos de `.open-next`, `.next`, CI y versiones previas del Worker pueden contener credenciales incrustadas. No reutilizarlos. Un build local nuevo reemplaza los artefactos locales utilizados; no limpia todas las copias históricas.
- Una versión vieja del Worker puede tener la contraseña antigua incrustada: **no asumir que hacer rollback del código restaura el servicio después de rotar Neon**. Preferir corregir la versión segura o preparar un artefacto recuperable sin secretos y con acceso a los secretos vigentes.

## Criterios de cierre

- [ ] DATABASE_URL remoto almacenado como Secret.
- [ ] Nueva versión desplegada y lecturas/escrituras comprobadas.
- [ ] Contraseña Neon rotada y Hyperdrive actualizado/probado.
- [ ] Conexiones nuevas con la contraseña antigua rechazadas.
- [ ] Token R2 expuesto revocado; integraciones restantes usan credenciales nuevas limitadas.
- [ ] Variables S3 antiguas retiradas del Worker.
- [ ] Historial/copias/artefactos revisados y procedimiento de recuperación actualizado.

Hasta comprobar los pasos remotos, la implementación local está preparada, pero la fase 2 no está completada operativamente.

Referencias oficiales: [Secrets de Workers](https://developers.cloudflare.com/workers/configuration/secrets/), [rotación Hyperdrive](https://developers.cloudflare.com/hyperdrive/configuration/rotate-credentials/), [roles Neon](https://neon.com/docs/manage/roles).
