// FuelFlow build script (esbuild). Usage:
//   node build.mjs          → production build into dist/
//   node build.mjs --serve  → dev server on http://localhost:5173 with rebuild on change
import * as esbuild from 'esbuild';
import { cp, mkdir, rm, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const serve = process.argv.includes('--serve');
const outdir = 'dist';

await rm(outdir, { recursive: true, force: true });
await mkdir(`${outdir}/assets`, { recursive: true });
await copyFile('index.html', `${outdir}/index.html`);
await cp('public', outdir, { recursive: true });

const options = {
  entryPoints: { main: 'src/main.tsx' },
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: `${outdir}/assets`,
  chunkNames: 'chunk-[hash]',
  jsx: 'automatic',
  target: ['es2020', 'safari15'],
  minify: !serve,
  sourcemap: serve ? 'inline' : false,
  define: { 'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production') },
  logLevel: 'info',
  legalComments: 'none',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: 5173 });
  console.log(`FuelFlow dev server: http://localhost:${port}`);
} else {
  const result = await esbuild.build({ ...options, metafile: true });
  const out = Object.entries(result.metafile.outputs).map(([f, o]) => `${f}  ${(o.bytes / 1024).toFixed(1)} kB`);
  console.log(out.join('\n'));
  await writeServiceWorker();
}

/** Lists every built file and stamps the service worker with a hash of their contents,
 *  so each deploy installs a fresh offline copy and removes the old one. */
async function writeServiceWorker() {
  const files = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else files.push(p);
    }
  };
  await walk(outdir);
  const list = files.map((f) => relative(outdir, f).split('\\').join('/')).filter((f) => f !== 'sw.js' && !f.startsWith('.')).sort();
  const hash = createHash('sha256');
  for (const f of list) hash.update(f).update(await readFile(join(outdir, f)));
  const version = hash.digest('hex').slice(0, 12);
  const template = await readFile('src/sw-template.js', 'utf8');
  const urls = ['./', ...list.map((f) => './' + f)];
  await writeFile(join(outdir, 'sw.js'), template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls)));
  console.log(`dist/sw.js  offline cache v${version} (${urls.length} files)`);
}
