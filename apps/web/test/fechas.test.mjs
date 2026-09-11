// Pruebas de zona horaria para `src/lib/fechas.ts`.
//
// Son las que exige la Fase 3 del plan, y cubren el fallo concreto contra el
// que avisa docs/discord-tareas.md: una fecha de entrega que se muestra un día
// antes según desde dónde se mire.
//
// Se ejecutan con `npm run check`. Node lee el .ts directamente (necesita
// Node >= 22.6, que es el que usan las dos apps); no hay paso de compilación.
//
//   node --test test/
//   TZ=Asia/Tokyo node --test test/     # la zona del proceso no debe importar

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esFechaValida, hoyEnLima, diasEntre, urgenciaDe, formatearFecha, textoVencimiento,
} from '../src/lib/fechas.ts';

test('la fecha no se desplaza un día: es el fallo que se quería evitar', () => {
  // Así es como se rompe: new Date('2026-09-10') es medianoche UTC, y en Lima
  // (UTC-5) el navegador la enseña como el 9.
  assert.equal(new Date('2026-09-10').toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), '2026-09-09');
  // Y así es como queda con los helpers: el día se conserva.
  assert.equal(formatearFecha('2026-09-10', '2026-09-01'), '10 sep');
  assert.equal(textoVencimiento('2026-09-10', '2026-09-10'), 'Vence hoy');
});

test('hoyEnLima da YYYY-MM-DD y no depende de la zona del proceso', () => {
  const hoy = hoyEnLima();
  assert.match(hoy, /^\d{4}-\d{2}-\d{2}$/);
  // Mismo resultado con el proceso en UTC y en Tokio: la zona va explícita.
  const enLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  assert.equal(hoy, enLima);
});

test('diasEntre cuenta días completos, incluso cruzando meses y años', () => {
  assert.equal(diasEntre('2026-09-10', '2026-09-10'), 0);
  assert.equal(diasEntre('2026-09-10', '2026-09-11'), 1);
  assert.equal(diasEntre('2026-09-10', '2026-09-09'), -1);
  assert.equal(diasEntre('2026-08-31', '2026-09-01'), 1);
  assert.equal(diasEntre('2026-12-31', '2027-01-01'), 1);
  assert.equal(diasEntre('2024-02-28', '2024-03-01'), 2); // bisiesto
});

test('el horario de verano del norte no mueve las cuentas', () => {
  // Lima no cambia de hora, pero el navegador de quien mire sí puede. La
  // aritmética va sobre Date.UTC, así que da igual.
  assert.equal(diasEntre('2026-03-07', '2026-03-09'), 2);
  assert.equal(diasEntre('2026-11-01', '2026-11-02'), 1);
});

test('urgencia clasifica vencida / hoy / proxima / futura', () => {
  const hoy = '2026-09-10';
  assert.equal(urgenciaDe('2026-09-09', hoy), 'vencida');
  assert.equal(urgenciaDe('2026-09-10', hoy), 'hoy');
  assert.equal(urgenciaDe('2026-09-13', hoy), 'proxima');  // 3 días
  assert.equal(urgenciaDe('2026-09-14', hoy), 'futura');   // 4 días
});

test('esFechaValida rechaza días que no existen', () => {
  assert.equal(esFechaValida('2026-09-10'), true);
  assert.equal(esFechaValida('2026-02-31'), false);
  assert.equal(esFechaValida('2026-13-01'), false);
  assert.equal(esFechaValida('10/09/2026'), false);
  assert.equal(esFechaValida(''), false);
  assert.equal(esFechaValida('2024-02-29'), true);  // bisiesto sí existe
  assert.equal(esFechaValida('2026-02-29'), false); // no bisiesto
});

test('formatearFecha añade el año solo cuando no es el corriente', () => {
  assert.equal(formatearFecha('2026-09-10', '2026-01-01'), '10 sep');
  assert.equal(formatearFecha('2027-01-05', '2026-01-01'), '5 ene 2027');
});

test('textoVencimiento habla en relativo cerca y en fecha lejos', () => {
  const hoy = '2026-09-10';
  assert.equal(textoVencimiento('2026-09-08', hoy), 'Venció hace 2 días');
  assert.equal(textoVencimiento('2026-09-09', hoy), 'Venció ayer');
  assert.equal(textoVencimiento('2026-09-11', hoy), 'Vence mañana');
  assert.equal(textoVencimiento('2026-09-12', hoy), 'Vence en 2 días');
  assert.equal(textoVencimiento('2026-10-20', hoy), '20 oct');
});

test('un año a medio teclear no es una fecha válida', () => {
  // Es lo que llegaba a la Server Action al escribir la fecha a mano.
  assert.equal(esFechaValida('0002-09-25'), false);
  assert.equal(esFechaValida('0202-09-25'), false);
  assert.equal(esFechaValida('2000-01-01'), true);
  assert.equal(esFechaValida('2100-12-31'), true);
  assert.equal(esFechaValida('2101-01-01'), false);
});
