/* Inlines the favicon into the single-file build so the demo HTML has no
 * external references at all and renders correctly from file:// */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const html = 'dist-single/index.html';
const icon = 'dist-single/favicon.svg';
if (existsSync(html) && existsSync(icon)) {
  const data = `data:image/svg+xml;base64,${readFileSync(icon).toString('base64')}`;
  writeFileSync(html, readFileSync(html, 'utf8').replace('href="/favicon.svg"', `href="${data}"`));
  rmSync(icon);
  console.log('favicon inlined — dist-single/index.html is fully self-contained');
}
