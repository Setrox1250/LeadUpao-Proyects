// Pruebas de la decisión que toma el listener ante un UPDATE de `tareas`.
//
// Aquí vive el riesgo de rebote entre el foro y la base: un cambio hecho en
// Discord que el bot reenvía a Discord. Un bucle así no es algo que se quiera
// descubrir en el servidor con gente mirando.
//
// Se ejercita la función real (`decidirAccion`), sin red ni Discord.
//
//   node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { decidirAccion, estadoDeTag } = require('../services/supabaseListener.js');

test('escribir id_discord_hilo tras crear el hilo no dispara nada', () => {
  // Era el ruido real en producción: el bot publicaba "↩️ ha vuelto al
  // backlog" en un hilo que acababa de crear él mismo.
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: null, id_discord_hilo: null },
    new: { estado: 'BACKLOG', fecha_vencimiento: null, id_discord_hilo: '123' },
  });
  assert.equal(r.actuar, false);
});

test('cambiar solo la fecha avisa de la fecha y no del estado', () => {
  const r = decidirAccion({
    old: { estado: 'EN_PROGRESO', fecha_vencimiento: null },
    new: { estado: 'EN_PROGRESO', fecha_vencimiento: '2026-09-25' },
  }, ['En Progreso']);
  assert.equal(r.avisarFecha, true);
  assert.equal(r.reenviarEstado, false);
});

test('quitar la fecha también se anuncia', () => {
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: '2026-09-25' },
    new: { estado: 'BACKLOG', fecha_vencimiento: null },
  }, ['Backlog']);
  assert.equal(r.avisarFecha, true);
});

test('un cambio de estado desde la web se reenvía a Discord', () => {
  // El hilo lleva todavía la etiqueta vieja: la web va por delante.
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: null },
    new: { estado: 'COMPLETADO', fecha_vencimiento: null },
  }, ['Backlog']);
  assert.equal(r.reenviarEstado, true);
});

test('un cambio hecho EN Discord no rebota de vuelta a Discord', () => {
  // threadUpdate ya escribió el estado en la base, y el hilo lleva puesta la
  // etiqueta nueva. Reenviarlo publicaría un "desde el panel web" falso y
  // volvería a disparar threadUpdate.
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: null },
    new: { estado: 'COMPLETADO', fecha_vencimiento: null },
  }, ['Completado']);
  assert.equal(r.reenviarEstado, false);
  assert.equal(r.yaEtiquetado, true);
});

test('fecha y estado a la vez: se cuentan las dos cosas', () => {
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: null },
    new: { estado: 'EN_PROGRESO', fecha_vencimiento: '2026-10-01' },
  }, ['Backlog']);
  assert.equal(r.avisarFecha, true);
  assert.equal(r.reenviarEstado, true);
});

test('sin REPLICA IDENTITY FULL el evento pasa igual', () => {
  // `payload.old` llegaría vacío. Ante la duda, mejor un mensaje de más que
  // una tarea que se queda desincronizada para siempre.
  const r = decidirAccion(
    { old: {}, new: { estado: 'COMPLETADO', fecha_vencimiento: null } },
    ['Backlog'],
  );
  assert.equal(r.actuar, true);
  assert.equal(r.reenviarEstado, true);
});

test('un estado fuera del vocabulario no se reenvía', () => {
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: null },
    new: { estado: 'PENDIENTE', fecha_vencimiento: null },   // el estado viejo del bot
  }, ['Backlog']);
  assert.equal(r.reenviarEstado, false);
});

test('solo las etiquetas de estado cuentan como estado', () => {
  assert.equal(estadoDeTag('Completado'), 'COMPLETADO');
  assert.equal(estadoDeTag('completado'), 'COMPLETADO');  // sin distinguir mayúsculas
  assert.equal(estadoDeTag('En Progreso'), 'EN_PROGRESO');
  assert.equal(estadoDeTag('Urgente'), null);
  assert.equal(estadoDeTag('Documentación'), null);
});

test('una tarea con etiqueta Urgente además del estado no se confunde', () => {
  const r = decidirAccion({
    old: { estado: 'BACKLOG', fecha_vencimiento: null },
    new: { estado: 'COMPLETADO', fecha_vencimiento: null },
  }, ['Urgente', 'Completado', 'Documentación']);
  assert.equal(r.reenviarEstado, false, 'la etiqueta de estado ya está puesta');
});
