// Replaced at build time by esbuild (see build.mjs `define`).
declare const process: { env: { NODE_ENV: 'development' | 'production' } };

// Stylesheets are bundled by esbuild; this lets TypeScript accept `import './styles.css'`.
declare module '*.css';
