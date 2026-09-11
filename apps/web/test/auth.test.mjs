// Pruebas del RBAC. Existen por un fallo concreto: la migración 0007 pasó los
// cargos al español y `isFounder()` se quedó comparando 'President', así que
// devolvía false para los siete miembros y cerraba Configuración a todo el
// mundo. Nadie lo notó porque no hay nada que falle ruidosamente: la pestaña
// simplemente redirige.
//
// Los cargos de abajo son los verificados contra producción el 2026-09-10:
//   select distinct cargo from public.miembros;
//   → Miembro, Presidente, TI, Vicepresidente

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, isStaff, isFounder, getCargoLabel } from '../src/lib/auth.ts';

const CARGOS_EN_PRODUCCION = ['Miembro', 'Presidente', 'TI', 'Vicepresidente'];

const presidente    = { rol: 'admin',  cargo: 'Presidente',     pilar: null };
const vicepresidente = { rol: 'admin', cargo: 'Vicepresidente', pilar: null };
const ti            = { rol: 'admin',  cargo: 'TI',             pilar: null };
const lider         = { rol: 'staff',  cargo: 'Líder de Área',  pilar: 'Área Académica' };
const miembro       = { rol: 'member', cargo: 'Miembro',        pilar: 'Área Académica' };

test('Presidencia y Vicepresidencia entran a Configuración', () => {
  assert.equal(isFounder(presidente), true);
  assert.equal(isFounder(vicepresidente), true);
});

test('TI NO entra, aunque su nivel de permiso sea admin', () => {
  // Es el caso que la comprobación por cargo existe para excluir: si el
  // catálogo de permisos fuera editable desde un cargo de nivel admin,
  // comprometer esa cuenta bastaría para ampliarse los permisos.
  assert.equal(isAdmin(ti), true);
  assert.equal(isFounder(ti), false);
});

test('nadie más entra a Configuración', () => {
  for (const p of [lider, miembro, {}, { cargo: null }, { cargo: '' }]) {
    assert.equal(isFounder(p), false);
  }
});

test('al menos un cargo real de producción es fundador', () => {
  // Esto es lo que fallaba: ningún cargo existente pasaba el filtro.
  const fundadores = CARGOS_EN_PRODUCCION.filter(cargo => isFounder({ cargo }));
  assert.ok(fundadores.length > 0,
    'ningún cargo de los que existen en `miembros` puede abrir Configuración: ' +
    'el catálogo de cargos y el código se han desincronizado otra vez');
  assert.deepEqual(fundadores, ['Presidente', 'Vicepresidente']);
});

test('los nombres en inglés ya no existen y no se aceptan', () => {
  assert.equal(isFounder({ cargo: 'President' }), false);
  assert.equal(isFounder({ cargo: 'Vice-President' }), false);
});

test('isAdmin e isStaff siguen derivando de `rol`, no del cargo', () => {
  assert.equal(isAdmin(lider), false);
  assert.equal(isStaff(lider), true);
  assert.equal(isStaff(miembro), false);
  assert.equal(isAdmin(presidente), true);
});

test('la etiqueta de cargo prefiere el área cuando la hay', () => {
  assert.equal(getCargoLabel(lider), 'Área Académica');
  assert.equal(getCargoLabel(presidente), 'Presidente');
  assert.equal(getCargoLabel({}), '');
});
