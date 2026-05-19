import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npmJsPath = path.join(__dirname, 'node_modules', '@vscode', 'vsce', 'out', 'npm.js');

if (!fs.existsSync(npmJsPath)) {
    console.log('vsce npm.js not found, skipping patch');
    process.exit(0);
}

let content = fs.readFileSync(npmJsPath, 'utf8');

if (content.includes('shell: true')) {
    console.log('vsce npm.js already patched');
    process.exit(0);
}

content = content.replace(
    /const child = cp\.exec\(command, \{ \.\.\.options, encoding: 'utf8' \}/,
    "const child = cp.exec(command, { ...options, encoding: 'utf8', shell: true }"
);

content = content.replace(
    /async function checkNPM\(cancellationToken\) \{\s+const \{ stdout \} = await exec\('npm -v', \{\}, cancellationToken\);\s+const version = stdout\.trim\(\);\s+if \(\^3\\.7\\.\[0123\]\$\.test\(version\)\) \{\s+throw new Error\(`npm@\$\{version\} doesn't work with vsce\. Please update npm: npm install -g npm`\);\s+\}\s+\}/,
    `async function checkNPM(cancellationToken) {
\ttry {
\t\tconst { stdout } = await exec('npm -v', {}, cancellationToken);
\t\tconst version = stdout.trim();
\t\tif (/^3\\.7\\.[0123]$/.test(version)) {
\t\t\tthrow new Error(\`npm@\${version} doesn't work with vsce. Please update npm: npm install -g npm\`);
\t\t}
\t} catch (err) {
\t\tif (err.message && err.message.includes("3.7.")) throw err;
\t}
}`
);

content = content.replace(
    /\{ cwd, maxBuffer: 5000 \* 1024 \}\)\s*\n(\s*)\.then\(\(\{ stdout \}\) => stdout\.split/,
    "{ cwd, maxBuffer: 5000 * 1024, shell: true })\n$1.then(({ stdout }) => stdout.split"
);

content = content.replace(
    /\.filter\(dir => path\.isAbsolute\(dir\)\)\);/,
    ".filter(dir => path.isAbsolute(dir)))\n\t\t.catch(() => [cwd]);"
);

fs.writeFileSync(npmJsPath, content);
console.log('vsce npm.js patched successfully');
