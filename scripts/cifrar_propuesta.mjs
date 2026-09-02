// Genera public/propuesta.html: la sección interna del dashboard, CIFRADA.
// El contenido fuente (propuesta para Gerencia, con datos de compensación) JAMÁS
// entra al repo en claro: aquí se cifra con AES-256-GCM (clave derivada por
// PBKDF2-SHA256, 600,000 iteraciones) y al repo solo llega el texto cifrado.
// Sin la clave, la página no contiene nada legible — puede vivir en el repo público.
//
// Uso:  CLAVE_PROPUESTA="..." node scripts/cifrar_propuesta.mjs [fuente.html]
//   - La clave sale de la variable de entorno CLAVE_PROPUESTA o del .env local
//     (gitignoreado), igual que SHEET_ID. Nunca se escribe en el repo ni en logs.
//   - La fuente por defecto es .private/propuesta-fuente.html (gitignoreado).
//   - Para cambiar la clave: volver a correr con la clave nueva y commitear el
//     public/propuesta.html regenerado.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITERACIONES = 600000;

function clave() {
  if (process.env.CLAVE_PROPUESTA) return process.env.CLAVE_PROPUESTA.trim();
  const envPath = path.join(ROOT, '.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^CLAVE_PROPUESTA=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('No hay CLAVE_PROPUESTA: defínela como variable de entorno o en el .env local.');
}

const fuente = process.argv[2] || path.join(ROOT, '.private', 'propuesta-fuente.html');
if (!existsSync(fuente)) {
  throw new Error(`No existe la fuente ${fuente}. El contenido en claro vive fuera del repo (.private/ está gitignoreado).`);
}
const contenido = readFileSync(fuente, 'utf8');

// Documento completo que se reescribe tras descifrar.
const docCompleto = '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
  '<body style="margin:0">' + contenido + '</body></html>';

const enc = new TextEncoder();
const sal = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const material = await crypto.subtle.importKey('raw', enc.encode(clave()), 'PBKDF2', false, ['deriveKey']);
const llave = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: sal, iterations: ITERACIONES, hash: 'SHA-256' },
  material, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
);
const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, enc.encode(docCompleto)));

const b64 = (u8) => Buffer.from(u8).toString('base64');

const pagina = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sección interna</title>
<style>
  :root{--tinta:#17251F;--verde:#0B7A55;--fondo:#F4F6F3;--carta:#fff;--linea:#DCE3DE;--gris:#5C6B63;}
  body{margin:0;background:var(--fondo);color:var(--tinta);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}
  .caja{background:var(--carta);border:1px solid var(--linea);border-radius:14px;padding:28px 26px;max-width:400px;width:100%;}
  .marca{font-size:.72rem;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--verde);margin-bottom:10px;}
  h1{font-size:1.25rem;margin:0 0 8px;}
  p{font-size:.9rem;color:var(--gris);line-height:1.55;margin:.4rem 0 1rem;}
  input{width:100%;box-sizing:border-box;font-size:1rem;padding:11px 12px;border:1px solid var(--linea);
        border-radius:8px;background:var(--fondo);color:var(--tinta);}
  input:focus{outline:2px solid var(--verde);outline-offset:1px;}
  button{width:100%;margin-top:12px;font-size:1rem;font-weight:600;padding:11px;border:none;border-radius:8px;
         background:var(--verde);color:#fff;cursor:pointer;}
  button:disabled{opacity:.6;cursor:wait;}
  .error{color:#A33B2E;font-size:.85rem;margin-top:10px;display:none;}
</style>
</head>
<body>
<main class="caja">
  <div class="marca">Dashboard RRHH · Corporación Americana</div>
  <h1>Sección interna</h1>
  <p>Este documento está cifrado (AES-256). Sin la clave, la página no contiene información legible.
     Acceso solo para personal autorizado.</p>
  <input id="clave" type="password" autocomplete="off" placeholder="Clave de acceso" autofocus>
  <button id="abrir">Abrir</button>
  <div class="error" id="error">Clave incorrecta. Verifica e intenta de nuevo.</div>
</main>
<script>
const DATOS = { sal: "${b64(sal)}", iv: "${b64(iv)}", ct: "${b64(cifrado)}", iter: ${ITERACIONES} };
const aU8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function abrir() {
  const boton = document.getElementById('abrir');
  const error = document.getElementById('error');
  const clave = document.getElementById('clave').value;
  if (!clave) return;
  boton.disabled = true; error.style.display = 'none';
  try {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']);
    const llave = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: aU8(DATOS.sal), iterations: DATOS.iter, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: aU8(DATOS.iv) }, llave, aU8(DATOS.ct));
    const html = new TextDecoder().decode(plano);
    document.open(); document.write(html); document.close();
  } catch (e) {
    error.style.display = 'block'; boton.disabled = false;
  }
}
document.getElementById('abrir').addEventListener('click', abrir);
document.getElementById('clave').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
</script>
</body>
</html>
`;

const destino = path.join(ROOT, 'public', 'propuesta.html');
writeFileSync(destino, pagina);
console.log(`✅ public/propuesta.html generado (${(pagina.length / 1024).toFixed(1)} KB cifrados). La fuente y la clave NO están en el repo.`);
