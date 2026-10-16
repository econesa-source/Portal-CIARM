import test from 'node:test';
import assert from 'node:assert/strict';
import { IB_CLASSIFIED_CATALOG, computeFacets, filterCatalog, IB_SHARED_DRIVE_URL } from '../src/data/ibCatalog.js';

test('IB catalog data and AI facet computation are robust and complete', () => {
  assert.ok(IB_CLASSIFIED_CATALOG.length >= 24, 'Catalog should contain comprehensive entries');
  assert.equal(IB_SHARED_DRIVE_URL, 'https://drive.google.com/drive/folders/0APjAPL7f_pxtUk9PVA?hl=es');

  // Cada entrada tiene campos canónicos completos
  for (const item of IB_CLASSIFIED_CATALOG) {
    assert.ok(item.id, 'Item must have an id');
    assert.ok(item.titulo, 'Item must have a titulo');
    assert.ok(item.materia, 'Item must have a materia');
    assert.ok(item.grupo, 'Item must have a grupo');
    assert.ok(item.tipo, 'Item must have a tipo');
    assert.ok(['ES', 'EN'].includes(item.idioma), 'Idioma must be ES or EN');
    assert.ok(Array.isArray(item.tags) && item.tags.length > 0, 'Item must have tags');
    assert.ok(item.driveUrl.includes('drive.google.com'), 'Item must have a driveUrl');
  }

  // Cómputo de facetas dinámicas
  const facets = computeFacets(IB_CLASSIFIED_CATALOG);
  assert.ok(facets.grupos.length >= 7, 'Debe haber al menos 7 grupos canónicos');
  assert.ok(facets.materias.length >= 10, 'Debe haber materias indexadas');
  assert.ok(facets.tipos.length >= 3, 'Debe haber tipos documentales');
  assert.deepEqual(facets.idiomas, ['EN', 'ES']);
  assert.ok(facets.popularTags.length > 0, 'Debe haber tags populares calculados');

  // Filtrado facetado
  const onlySciences = filterCatalog(IB_CLASSIFIED_CATALOG, { grupo: 'Grupo 4: Ciencias' });
  assert.ok(onlySciences.length >= 7, 'Debe haber recursos de ciencias');
  assert.ok(onlySciences.every(i => i.grupo.includes('Ciencias')));

  const onlySpanish = filterCatalog(IB_CLASSIFIED_CATALOG, { idioma: 'ES' });
  assert.ok(onlySpanish.every(i => i.idioma === 'ES'));

  const querySearch = filterCatalog(IB_CLASSIFIED_CATALOG, { query: '3000-palabras' });
  assert.ok(querySearch.length >= 1, 'Debe encontrar la guía de Biología por tag');
});
