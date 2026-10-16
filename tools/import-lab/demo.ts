import type { Draft, Material } from './schema.js';

export function demo() {
  const text = 'Pasta al limone — esempio originale per il laboratorio. Per 2 persone. Ingredienti: 180 g di pasta, 20 g di olio, 1 limone, sale q.b. Cuoci la pasta in acqua salata. Mescola olio e scorza del limone. Scola la pasta e amalgama con il condimento.';
  const evidence = (quote: string) => ({ sourceId: 'text-1', quote });
  const material: Material = { sources: [{ id: 'text-1', kind: 'text', label: 'Esempio locale scritto per Recipeek', text }], photos: [], warnings: ['Esempio dimostrativo: nessuna acquisizione esterna e nessun modello eseguito.'], credits: 0, creditsAreEstimate: false };
  const draft: Draft = {
    classification: 'partial_recipe', title: 'Pasta al limone', description: 'Esempio locale per provare revisione e salvataggio.',
    servings: 2, servingsEvidence: evidence('Per 2 persone.'), prepMinutes: null, cookMinutes: null, category: 'Primo', cookingMethods: ['Bollitura'],
    ingredients: [
      { id: 'i1', name: 'Pasta', quantity: 180, unit: 'g', originalText: '180 g di pasta', evidence: evidence('180 g di pasta') },
      { id: 'i2', name: 'Olio', quantity: 20, unit: 'g', originalText: '20 g di olio', evidence: evidence('20 g di olio') },
      { id: 'i3', name: 'Limone', quantity: 1, unit: 'pezzo', originalText: '1 limone', evidence: evidence('1 limone') },
      { id: 'i4', name: 'Sale', quantity: null, unit: null, originalText: 'sale q.b.', evidence: evidence('sale q.b.') },
    ],
    steps: [
      { id: 's1', text: 'Cuoci la pasta in acqua salata.', ingredientIds: ['i1','i4'], evidence: evidence('Cuoci la pasta in acqua salata.') },
      { id: 's2', text: 'Mescola olio e scorza del limone.', ingredientIds: ['i2','i3'], evidence: evidence('Mescola olio e scorza del limone.') },
      { id: 's3', text: 'Scola la pasta e amalgama con il condimento.', ingredientIds: ['i1','i2','i3'], evidence: evidence('Scola la pasta e amalgama con il condimento.') },
    ],
    missingInformation: ['La fonte non specifica i tempi di preparazione e cottura.'],
  };
  return { material, draft };
}
