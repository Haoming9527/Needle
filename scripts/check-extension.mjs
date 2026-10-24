import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve('dist/extension');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
for (const file of [manifest.background.service_worker, manifest.side_panel.default_path, ...(manifest.content_scripts ?? []).flatMap(script => script.js), ...Object.values(manifest.icons)]) await access(join(root, file));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 is required.');
if (manifest.permissions.includes('<all_urls>')) throw new Error('URL permission must be in host_permissions.');
// Chrome requires <all_urls> for captureVisibleTab initiated by a page gesture.
// The requested right-click toolbar runs on ordinary HTTP(S) documents only.
const approvedMatches = new Set(['http://*/*', 'https://*/*']);
if ((manifest.content_scripts ?? []).some(script => script.all_frames || script.matches.some(match => !approvedMatches.has(match)))) throw new Error('Unexpected content-script scope.');
if (!manifest.content_scripts?.some(script => [...approvedMatches].every(match => script.matches.includes(match)) && script.run_at === 'document_start')) throw new Error('The right-click toolbar must start on every ordinary webpage.');
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (/\.(js|json|html)$/.test(entry.name)) {
      const text = await readFile(path, 'utf8');
      if (/sk-proj-[A-Za-z0-9_-]{16,}/.test(text)) throw new Error('Credential-like string in extension output.');
      if (/import\s.*(?:https?:|node:)/.test(text)) throw new Error('Remote or Node module import in extension.');
    }
  }
}
await inspect(root);
console.log('Extension package verified: manifest, worker, content script, panel, icons, and bundled scripts.');
