import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

test('local lab: demo, explicit approval, persisted human edits and origin protection', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'tools/import-lab/server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: '4327' }, windowsHide: true, stdio: 'pipe' });
  let created: string | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) { try { const response = await fetch('http://127.0.0.1:4327/api/status'); if (response.ok) { ready = true; break; } } catch {} await delay(100); }
    assert.ok(ready, 'server should start');
    const post = (path: string, value: unknown, origin?: string) => fetch(`http://127.0.0.1:4327${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(value) });
    assert.equal((await post('/api/demo', {}, 'https://evil.example')).status, 403);
    const demoResponse = await post('/api/demo', {}); assert.equal(demoResponse.status, 200);
    const job = await demoResponse.json() as { id: string; draft: { title: string }; demo: boolean };
    created = job.id; assert.equal(job.demo, true);
    const review = { id: job.id, decision: 'accepted', confirmed: false, draft: job.draft, notes: 'smoke test', rating: 'minor_edits', correctionSeconds: 3 };
    assert.equal((await post('/api/review', review)).status, 400);
    job.draft.title = 'Titolo corretto';
    const saved = await post('/api/review', { ...review, confirmed: true }); assert.equal(saved.status, 200);
    const persisted = JSON.parse(await readFile(join(process.cwd(), '.local/import-lab', `${job.id}.json`), 'utf8'));
    assert.equal(persisted.state, 'accepted');
    assert.notEqual(persisted.draft.title, 'Titolo corretto');
    assert.equal(persisted.review.draft.title, 'Titolo corretto');
    assert.equal((await fetch('http://127.0.0.1:4327/.env.local')).status, 404);
  } finally {
    child.kill();
    if (created) await rm(join(process.cwd(), '.local/import-lab', `${created}.json`), { force: true });
  }
});
