// FuelFlow build script (esbuild). Usage:
//   node build.mjs          → production build into dist/
//   node build.mjs --serve  → dev server on http://localhost:5173 with rebuild on change
import * as esbuild from 'esbuild';
import { cp, mkdir, rm, copyFile } from 'node:fs/promises';

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
}
