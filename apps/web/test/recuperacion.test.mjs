// Pruebas de la lógica de recuperación de contraseña.
//
// Es el único camino que escribe en `miembros` SIN sesión, así que lo que hay
// que fijar no es el caso feliz: son los que fallan. Se reproducen aquí las
// reglas de `lib/actions/recuperacion.ts` sobre datos, sin red ni base.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validarContrasena } from '../src/lib/password.ts';

const VIGENCIA_MINUTOS = 15;
const MAX_INTENTOS     = 5;
const REEMISION_SEGUNDOS = 60;

const ahora = Date.now();
const enMinutos = (m) => new Date(ahora + m * 60_000).toISOString();

// Misma condición que usa restablecerConCodigo para aceptar un canje.
const vigente = (m) => Boolean(
  m?.recuperacion_hash &&
  m.recuperacion_expira_en &&
  Date.parse(m.recuperacion_expira_en) > ahora &&
  (m.recuperacion_intentos ?? 0) < MAX_INTENTOS
);

// Misma condición que usa solicitarRecuperacion para no reemitir.
const demasiadoPronto = (m) => {
  const expira = m.recuperacion_expira_en ? Date.parse(m.recuperacion_expira_en) : 0;
  const emitidoHace = VIGENCIA_MINUTOS * 60_000 - (expira - ahora);
  return expira > ahora && emitidoHace < REEMISION_SEGUNDOS * 1000;
};

const conCodigo = (codigo, extra = {}) => ({
  recuperacion_hash: hashPassword(codigo),
  recuperacion_expira_en: enMinutos(VIGENCIA_MINUTOS),
  recuperacion_intentos: 0,
  ...extra,
});

test('el código correcto y fresco se acepta', () => {
  const m = conCodigo('123456');
  assert.equal(vigente(m), true);
  assert.equal(verifyPassword('123456', m.recuperacion_hash), true);
});

test('el código NO se guarda en claro', () => {
  const m = conCodigo('123456');
  assert.ok(!m.recuperacion_hash.includes('123456'),
    'quien lea la base podría entrar con lo que encuentre');
  assert.match(m.recuperacion_hash, /^[0-9a-f]+:[0-9a-f]+$/);
});

test('un código caducado no sirve aunque se acierte', () => {
  const m = conCodigo('123456', { recuperacion_expira_en: enMinutos(-1) });
  assert.equal(vigente(m), false);
  // Acertar el número no basta: la vigencia se comprueba antes.
  assert.equal(verifyPassword('123456', m.recuperacion_hash), true);
});

test('agotar los intentos invalida el código', () => {
  assert.equal(vigente(conCodigo('123456', { recuperacion_intentos: MAX_INTENTOS - 1 })), true);
  assert.equal(vigente(conCodigo('123456', { recuperacion_intentos: MAX_INTENTOS })), false);
});

test('sin recuperación en curso no se acepta nada', () => {
  assert.equal(vigente({ recuperacion_hash: null, recuperacion_expira_en: null }), false);
  assert.equal(vigente(null), false);
  assert.equal(vigente(undefined), false);
});

test('un código equivocado no cuela', () => {
  const m = conCodigo('123456');
  for (const intento of ['123457', '000000', '12345', '1234567', '', 'abcdef']) {
    assert.equal(verifyPassword(intento, m.recuperacion_hash), false, `coló "${intento}"`);
  }
});

test('no se reemite mientras el anterior sigue fresco', () => {
  // Recién emitido: caduca dentro de casi los 15 minutos completos.
  assert.equal(demasiadoPronto({ recuperacion_expira_en: enMinutos(VIGENCIA_MINUTOS) }), true);
  // Emitido hace más de un minuto: ya se puede pedir otro.
  assert.equal(demasiadoPronto({ recuperacion_expira_en: enMinutos(VIGENCIA_MINUTOS - 2) }), false);
  // Sin ninguno previo.
  assert.equal(demasiadoPronto({ recuperacion_expira_en: null }), false);
  // Uno caducado no bloquea la emisión de otro.
  assert.equal(demasiadoPronto({ recuperacion_expira_en: enMinutos(-5) }), false);
});

test('la política de contraseñas se aplica igual que en el resto del panel', () => {
  assert.equal(validarContrasena('abc12345'), null);
  assert.ok(validarContrasena('corta1'));        // menos de 8
  assert.ok(validarContrasena('solocaracteres')); // sin número
  assert.ok(validarContrasena('12345678'));      // sin letra
});

test('dos códigos distintos no comparten hash', () => {
  // Sal aleatoria: dos personas con el mismo código no se delatan entre sí.
  assert.notEqual(hashPassword('123456'), hashPassword('123456'));
});

test('el formato del código es de seis dígitos, con ceros a la izquierda', () => {
  // String(randomInt(0, 1_000_000)).padStart(6, '0')
  for (const n of [0, 7, 999, 999999]) {
    const codigo = String(n).padStart(6, '0');
    assert.match(codigo, /^\d{6}$/, `"${codigo}" no tiene seis dígitos`);
  }
});
