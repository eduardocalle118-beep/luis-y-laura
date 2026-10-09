# Seguridad – Luis & Laura

Ninguna contraseña, respuesta, ID de Sheet ni llave queda en el código del navegador.
Todo se valida en Netlify Functions y se configura con variables de entorno.

## Estructura

```
├── index.html                      Sitio principal (sin secretos)
├── admin.html                      Panel admin (login contra el servidor)
├── netlify.toml                    Cabeceras de seguridad (CSP, HSTS, etc.) y carpeta de funciones
├── package.json
├── .env.example                    Plantilla de variables (para pruebas locales)
├── .gitignore                      Evita subir .env
└── netlify/functions/
    ├── verify-gate.js              Valida la primera pregunta (GATE_ANSWER) → token de sesión
    ├── get-data.js                 Lee el Google Sheet en el servidor (requiere token)
    ├── verify-admin.js             Valida la contraseña del admin (ADMIN_PASSWORD)
    ├── admin-status.js             Muestra qué variables están configuradas (solo admin)
    └── utils/security.js           Tokens firmados, comparación segura, límite de intentos
```

## Variables de entorno (Netlify → Site configuration → Environment variables)

| Variable          | Para qué sirve                                   | Ejemplo                          |
|-------------------|--------------------------------------------------|----------------------------------|
| `GATE_ANSWER`     | Respuesta a "¿Cuál es el color favorito de Luis?"| `azul`                           |
| `ADMIN_PASSWORD`  | Contraseña del Panel Admin                       | `MiClaveLarga#2026!`             |
| `GOOGLE_SHEET_ID` | ID del Google Sheet con fotos y razones          | `1AbC...xyz` (de la URL del Sheet)|
| `SESSION_SECRET`  | Clave para firmar las sesiones                   | cadena aleatoria de 64 caracteres|
| `START_DATE`      | Fecha de inicio del cronómetro                   | `2023-10-08`                     |

`SESSION_SECRET` sugerida (puedes generar otra con `openssl rand -hex 32`):

```
c4b92b76541a05048ccd734bb4c3be429dcc315ec63c2920a5ad6a129d2e98b4
```

### Cómo sacar el `GOOGLE_SHEET_ID`
En la URL `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`, copia lo que está entre `/d/` y `/edit`.
El Sheet debe estar compartido como **"Cualquier persona con el enlace – Lector"** para que la función pueda leerlo.

### Cómo cargarlas en Netlify
1. Netlify → tu sitio → **Site configuration → Environment variables → Add a variable**.
2. Crea las 5 variables de la tabla (marca **Contains secret values** en `ADMIN_PASSWORD`, `SESSION_SECRET` y `GATE_ANSWER`).
3. **Deploys → Trigger deploy → Deploy site** (las variables solo se aplican en un deploy nuevo).

## Qué protege cada cosa
- **Primera pregunta**: se compara en el servidor (tiempo constante), ignora mayúsculas y tildes, máx. 5 intentos/min por IP.
- **Datos del Sheet**: solo se entregan con un token firmado (6 h). El ID del Sheet nunca llega al navegador.
- **Panel admin**: contraseña validada en el servidor, token de 30 min, máx. 5 intentos/5 min por IP.
- **Cabeceras** (`netlify.toml`): CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Contenido del Sheet** se pinta con `textContent` (sin `innerHTML`) y solo se aceptan imágenes `https://`.

## Notas
- Ya no se puede cambiar la respuesta secreta ni la fecha desde el panel (antes se guardaba en el navegador, lo que no era seguro). Ahora se cambian en las variables de entorno y se vuelve a desplegar.
- El límite de intentos vive en memoria de la función: es una barrera razonable pero no absoluta. Usa una `ADMIN_PASSWORD` larga.
- Si cambias `SESSION_SECRET`, todas las sesiones activas se cierran.
- Prueba local: `npm install && npx netlify dev` con un archivo `.env` copiado de `.env.example`.
