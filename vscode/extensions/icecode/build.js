const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

console.log('Starting build...');
console.log('Source file:', path.join(__dirname, 'src', 'extension.ts'));
console.log('Output dir:', path.join(__dirname, 'dist'));

esbuild.build({
  entryPoints: {
    extension: path.join(__dirname, 'src', 'extension.ts')
  },
  bundle: true,
  outdir: path.join(__dirname, 'dist'),
  platform: 'node',
  target: ['node20'],
  external: ['vscode'],
  sourcemap: true,
  minify: false,
  format: 'cjs',
  logLevel: 'info'
}).then((result) => {
  console.log('Build succeeded!');
  console.log('Checking dist directory...');
  if (fs.existsSync(path.join(__dirname, 'dist'))) {
    console.log('dist directory exists!');
    const files = fs.readdirSync(path.join(__dirname, 'dist'));
    console.log('Files in dist:', files);
  } else {
    console.log('dist directory does not exist');
  }
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
