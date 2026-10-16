const $ = id => document.getElementById(id);
let mode = 'url', current = null, edited = null, startedReview = 0, objectUrls = [], reviewUrls = [], selectedPhotos = [], selectedRecipe;
const userEvidence = () => ({ sourceId: 'user', quote: 'Inserito o corretto dall’utente durante la revisione.' });
function element(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }
function fail(message) { $('error').textContent = message; $('error').hidden = false; }
function clearError() { $('error').hidden = true; }
async function api(path, data) { const res = await fetch(path, data === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); const body = await res.json(); if (!res.ok) throw new Error(body.error || 'Richiesta non riuscita.'); return body; }
async function status() { try { const s = await api('/api/status'); $('provider-status').textContent = `Gemini: ${s.gemini ? 'configurato' : 'chiave da configurare'} · Supadata: ${s.supadata ? 'configurato' : 'chiave da configurare'} · ${s.liveCalls}/${s.sessionLimit} tentativi nella sessione`; } catch { $('provider-status').textContent = 'Laboratorio non raggiungibile.'; } }
function setBusy(busy) { $('import-button').disabled = busy; $('demo-button').disabled = busy; }
function setMode(next) { mode = next; for (const tab of document.querySelectorAll('[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode)); for (const kind of ['url','photos','text']) $(`${kind}-panel`).hidden = kind !== mode; clearError(); }
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
$('url').addEventListener('input', () => { selectedRecipe = undefined; $('recipe-choice').hidden = true; });
$('recipe-index').addEventListener('change', () => { selectedRecipe = Number($('recipe-index').value); });
$('photos').addEventListener('change', () => {
  objectUrls.forEach(URL.revokeObjectURL); objectUrls = []; selectedPhotos = [...$('photos').files]; $('previews').replaceChildren();
  if (selectedPhotos.length > 4 || selectedPhotos.reduce((n, p) => n + p.size, 0) > 12000000 || selectedPhotos.some(p => p.size > 8000000)) { fail('Massimo 4 foto, 8 MB ciascuna e 12 MB complessivi.'); selectedPhotos = []; return; }
  clearError();
  for (const [index, file] of selectedPhotos.entries()) { const url = URL.createObjectURL(file); objectUrls.push(url); const box = element('div', undefined, 'preview'); const img = element('img'); img.src = url; img.alt = `Pagina ${index + 1}: ${file.name}`; box.append(img, element('span', `${index + 1}. ${file.name}`)); $('previews').append(box); }
});
function photoData(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Impossibile leggere la foto.')); reader.onload = () => resolve({ name: file.name, mimeType: file.type, data: String(reader.result).split(',')[1] }); reader.readAsDataURL(file); }); }
$('import-form').addEventListener('submit', async event => {
  event.preventDefault(); clearError(); setBusy(true); $('status').textContent = 'Preparazione del contenuto…';
  try {
    let input;
    const sourcePhotos = mode === 'photos' ? [...selectedPhotos] : [];
    if (mode === 'photos') { if (!selectedPhotos.length) throw new Error('Scegli almeno una foto.'); input = { kind: 'photos', photos: await Promise.all(selectedPhotos.map(photoData)) }; }
    else if (mode === 'text') input = { kind: 'text', text: $('source-text').value };
    else input = { kind: 'url', url: $('url').value, ...(selectedRecipe === undefined ? {} : { recipeIndex: selectedRecipe }) };
    const result = await api('/api/import', input);
    while (true) {
      const job = await api(`/api/jobs/${result.id}`);
      if (job.state === 'failed') throw new Error(job.error);
      if (job.state === 'selection_required') {
        $('recipe-index').replaceChildren(...job.titles.map((title, i) => { const option = element('option', title); option.value = String(i); return option; })); selectedRecipe = 0; $('recipe-choice').hidden = false; $('status').textContent = 'Scegli la ricetta e premi nuovamente Crea bozza.'; break;
      }
      if (job.state === 'draft') { show(job, sourcePhotos); $('status').textContent = 'Bozza pronta da verificare.'; break; }
      $('status').textContent = job.state === 'acquiring' ? 'Acquisizione della fonte…' : 'Lettura e organizzazione della ricetta…';
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) { fail(e.message); $('status').textContent = ''; } finally { setBusy(false); await status(); }
});
$('demo-button').addEventListener('click', async () => { clearError(); setBusy(true); try { show(await api('/api/demo', {})); $('status').textContent = 'Esempio caricato. Nessuna chiamata AI.'; } catch (e) { fail(e.message); } finally { setBusy(false); } });
function input(value, type, label, changed) { const el = element('input'); el.type = type; el.value = value ?? ''; el.setAttribute('aria-label', label); if (type === 'number') { el.step = 'any'; el.min = '0'; } el.addEventListener('input', () => changed(type === 'number' ? el.value === '' ? null : Number(el.value) : el.value)); return el; }
function renderIngredients() {
  $('ingredients').replaceChildren();
  for (const item of edited.ingredients) {
    const row = element('div', undefined, 'ingredient'); const fields = element('div', undefined, 'ingredient-fields');
    const change = key => value => { item[key] = value; item.evidence = userEvidence(); };
    const remove = element('button', '×', 'remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Rimuovi ${item.name}`); remove.onclick = () => { edited.ingredients = edited.ingredients.filter(i => i !== item); for (const s of edited.steps) s.ingredientIds = s.ingredientIds.filter(id => id !== item.id); renderIngredients(); renderSteps(); };
    fields.append(input(item.name, 'text', 'Ingrediente', change('name')), input(item.quantity, 'number', `Quantità ${item.name}`, change('quantity')), input(item.unit, 'text', `Unità ${item.name}`, change('unit')), remove);
    row.append(fields, element('p', `${item.evidence.sourceId} · ${item.originalText}`, 'evidence')); $('ingredients').append(row);
  }
}
function renderSteps() {
  $('steps').replaceChildren();
  for (const [index, step] of edited.steps.entries()) {
    const row = element('div', undefined, 'step'); const text = element('textarea'); text.value = step.text; text.rows = 2; text.setAttribute('aria-label', `Passaggio ${index + 1}`); text.oninput = () => { step.text = text.value; step.evidence = userEvidence(); };
    const remove = element('button', '×', 'remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Rimuovi passaggio ${index + 1}`); remove.onclick = () => { edited.steps = edited.steps.filter(s => s !== step); renderSteps(); };
    const ingredients = element('select'); ingredients.multiple = true; ingredients.setAttribute('aria-label', `Ingredienti del passaggio ${index + 1}`);
    for (const item of edited.ingredients) { const option = element('option', item.name); option.value = item.id; option.selected = step.ingredientIds.includes(item.id); ingredients.append(option); }
    ingredients.onchange = () => { step.ingredientIds = [...ingredients.selectedOptions].map(o => o.value); };
    row.append(element('span', String(index + 1).padStart(2, '0'), 'step-number'), text, remove, element('p', `${step.evidence.sourceId} · «${step.evidence.quote}»`, 'evidence'), ingredients, element('small', 'Ingredienti collegati allo step. Le quantità totali non vengono ripetute automaticamente.')); $('steps').append(row);
  }
}
function show(job, photos = []) {
  reviewUrls.forEach(URL.revokeObjectURL); reviewUrls = [];
  current = job; edited = structuredClone(job.review?.draft ?? job.draft); startedReview = Date.now(); $('empty').hidden = true; $('result').hidden = false; $('result-badge').hidden = false; $('result-badge').textContent = job.demo ? 'ESEMPIO · senza AI' : 'BOZZA · da verificare';
  const cost = job.usage?.estimatedAiUsd; const credits = job.material?.credits;
  $('metrics').textContent = `${(job.elapsedMs / 1000).toFixed(1)} s · AI: ${cost == null ? 'costo non disponibile' : `~$${cost.toFixed(4)}`} · Supadata: ${credits == null ? 'crediti non disponibili' : `${credits} crediti${job.material.creditsAreEstimate ? ' stimati, verificare dashboard' : ''}`}`;
  const warnings = [...(job.material?.warnings ?? []), ...(job.validation?.blocking ?? []), ...(job.validation?.warnings ?? [])];
  $('warnings').replaceChildren(...warnings.map(w => element('li', w))); $('warnings-summary').textContent = `${warnings.length} punti da controllare`; $('warnings-box').open = warnings.length > 0;
  $('title').value = edited.title ?? ''; $('servings').value = edited.servings ?? ''; $('prep').value = edited.prepMinutes ?? ''; $('cook').value = edited.cookMinutes ?? ''; $('confirmed').checked = false; $('notes').value = ''; $('rating').value = 'minor_edits';
  renderIngredients(); renderSteps();
  $('sources').replaceChildren(...job.material.sources.map((source, index) => { const div = element('div', undefined, 'source'); div.append(element('strong', `${source.id} · ${source.label}`)); if (source.kind === 'photo' && photos[index]) { const img = element('img'); const url = URL.createObjectURL(photos[index]); reviewUrls.push(url); img.src = url; img.alt = source.label; img.className = 'source-photo'; div.append(img); } div.append(element('pre', source.kind === 'photo' ? 'Confronta dosi e passaggi con la pagina originale.' : source.text)); return div; }));
  $('raw').textContent = JSON.stringify(job.draft, null, 2);
}
$('add-ingredient').onclick = () => { if (!edited) return; const n = Math.max(0, ...edited.ingredients.map(i => Number(i.id.slice(1)))) + 1; edited.ingredients.push({ id: `i${n}`, name: '', quantity: null, unit: null, originalText: 'Aggiunto durante la revisione', evidence: userEvidence() }); renderIngredients(); renderSteps(); };
$('add-step').onclick = () => { if (!edited) return; const n = Math.max(0, ...edited.steps.map(s => Number(s.id.slice(1)))) + 1; edited.steps.push({ id: `s${n}`, text: '', ingredientIds: [], evidence: userEvidence() }); renderSteps(); };
function syncFields() { edited.title = $('title').value || null; for (const [field, id] of [['servings','servings'],['prepMinutes','prep'],['cookMinutes','cook']]) { const value = $(id).value === '' ? null : Number($(id).value); if (field === 'servings' && value !== edited.servings) edited.servingsEvidence = value === null ? null : userEvidence(); edited[field] = value; } }
async function review(decision) { if (!current) return; clearError(); syncFields(); try { const result = await api('/api/review', { id: current.id, decision, confirmed: $('confirmed').checked, draft: edited, notes: $('notes').value, rating: $('rating').value, correctionSeconds: Math.round((Date.now() - startedReview) / 1000) }); current = result; $('result-badge').textContent = `${current.demo ? 'ESEMPIO · ' : ''}${decision === 'accepted' ? 'CONFERMATO' : 'RIGETTATO'}`; $('status').textContent = 'Valutazione salvata in .local/import-lab.'; } catch (e) { fail(e.message); } }
$('save').onclick = () => review('accepted'); $('reject').onclick = () => review('rejected');
$('export').onclick = () => { if (!current) return; syncFields(); const url = URL.createObjectURL(new Blob([JSON.stringify({ ...current, editedDraft: edited }, null, 2)], { type: 'application/json' })); const a = element('a'); a.href = url; a.download = `recipeek-${current.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
void status(); setInterval(status, 10000);
