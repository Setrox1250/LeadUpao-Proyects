const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

/**
 * Genera el banner de bienvenida como PNG, sin navegador.
 *
 * Reemplaza a `node-html-to-image`, que arrastraba Puppeteer y una descarga de
 * Chromium: fallaba el build en Render y aportaba la única vulnerabilidad
 * crítica del árbol de dependencias. Aquí se construye un SVG controlado y se
 * rasteriza con @resvg/resvg-js, que es una librería nativa sin navegador.
 */

const ANCHO = 1000;
const ALTO  = 500;

const FUENTE = path.join(__dirname, '../templates/Roboto-Regular.ttf');

/** Escapa texto para insertarlo en un nodo SVG. */
function esc(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Recorta el nombre y elige el tamaño de fuente.
 * Los nombres de Discord llegan hasta 32 caracteres, y con emojis o alfabetos
 * no latinos ocupan bastante más de lo que sugiere `length`.
 */
function ajustarNombre(nombre) {
    const caracteres = [...String(nombre ?? '').trim()];
    const limpio = caracteres.length > 18
        ? caracteres.slice(0, 18).join('') + '…'   // se ve que está recortado
        : caracteres.join('');
    const visible = limpio || 'NUEVO MIEMBRO';
    const n = [...visible].length;
    return { texto: visible.toUpperCase(), tamano: n > 15 ? 34 : n > 11 ? 44 : 56 };
}

/** Descarga el avatar y lo devuelve como data URI. `null` si falla. */
async function descargarAvatar(url) {
    if (!url) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const tipo = res.headers.get('content-type') ?? 'image/png';
        const b64  = Buffer.from(await res.arrayBuffer()).toString('base64');
        return `data:${tipo};base64,${b64}`;
    } catch {
        return null;
    }
}

function construirSvg({ nombre, avatarDataUri }) {
    const { texto, tamano } = ajustarNombre(nombre);

    // Si el avatar no se pudo descargar, se dibuja un marcador con la inicial:
    // el banner sale igual en lugar de caer al fallback de texto.
    const inicial = [...texto][0] ?? '?';
    const avatar = avatarDataUri
        ? `<image href="${avatarDataUri}" x="86" y="161" width="238" height="238"
                 preserveAspectRatio="xMidYMid slice" clip-path="url(#recorteAvatar)"/>`
        : `<circle cx="205" cy="280" r="119" fill="#1b1a5c"/>
           <text x="205" y="280" text-anchor="middle" dominant-baseline="central"
                 font-family="Roboto" font-size="96" fill="#ffffff" opacity="0.85">${esc(inicial)}</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#030C40"/>
      <stop offset="40%"  stop-color="#110E52"/>
      <stop offset="100%" stop-color="#1F0B4D"/>
    </linearGradient>
    <linearGradient id="aro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#D93240"/>
      <stop offset="50%"  stop-color="#A6249D"/>
      <stop offset="100%" stop-color="#7957F2"/>
    </linearGradient>
    <linearGradient id="burbuja" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#A6249D"/>
      <stop offset="100%" stop-color="#7957F2"/>
    </linearGradient>
    <linearGradient id="mancha" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0%"   stop-color="#8B6BF5"/>
      <stop offset="100%" stop-color="#6741D9"/>
    </linearGradient>
    <clipPath id="recorteAvatar"><circle cx="205" cy="280" r="119"/></clipPath>
    <clipPath id="recorteLienzo"><rect width="${ANCHO}" height="${ALTO}"/></clipPath>
  </defs>

  <g clip-path="url(#recorteLienzo)">
    <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)"/>

    <ellipse cx="120" cy="240" rx="215" ry="330" fill="url(#mancha)" opacity="0.85"/>
    <ellipse cx="150" cy="250" rx="190" ry="290" fill="#A6249D" opacity="0.35"/>

    <circle cx="775" cy="102" r="22" fill="url(#burbuja)"/>
    <circle cx="858" cy="222" r="42" fill="url(#burbuja)"/>
    <circle cx="825" cy="327" r="17" fill="url(#burbuja)"/>
    <!-- Estrella trazada, no glifo: Roboto-Regular no incluye ✦ y resvg
         dibujaría el rectángulo de carácter ausente. -->
    <path d="M893 400 L900 419 L919 426 L900 433 L893 452 L886 433 L867 426 L886 419 Z"
          fill="#ffffff" opacity="0.7"/>

    <text x="45" y="58" font-family="Roboto" font-size="26" font-weight="900"
          fill="#ffffff" letter-spacing="2">LEAD | UPAO</text>
    <text x="45" y="76" font-family="Roboto" font-size="10" font-weight="700"
          fill="#ffffff" opacity="0.8" letter-spacing="2.5">LEARN. EXPLORE. ASPIRE. DISCOVER</text>

    <circle cx="205" cy="280" r="129" fill="url(#aro)"/>
    <circle cx="205" cy="280" r="119" fill="#030C40"/>
    ${avatar}

    <text x="380" y="268" font-family="Roboto" font-size="76" fill="#ffffff"
          letter-spacing="3">BIENVENID@</text>
    <text x="380" y="${268 + tamano + 14}" font-family="Roboto" font-size="${tamano}"
          font-weight="800" fill="#ffffff" opacity="0.95">${esc(texto)}</text>
  </g>
</svg>`;
}

/**
 * Devuelve el PNG del banner. Lanza si el rasterizado falla, para que quien
 * llame decida el fallback.
 */
async function generarBanner({ nombre, avatarURL }) {
    const svg = construirSvg({ nombre, avatarDataUri: await descargarAvatar(avatarURL) });

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: ANCHO },
        font: {
            fontFiles: [FUENTE],
            loadSystemFonts: false,   // determinista: mismo resultado en local y en Render
            defaultFontFamily: 'Roboto',
        },
    });

    return resvg.render().asPng();
}

module.exports = { generarBanner, construirSvg, ajustarNombre };
