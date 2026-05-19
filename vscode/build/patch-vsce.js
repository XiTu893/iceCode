const fs = require('fs');
const path = require('path');

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
    "const child = cp.exec(command, { ...options, encoding: 'utf8' }, (err, stdout, stderr) => {",
    "const child = cp.exec(command, { ...options, encoding: 'utf8', shell: true }, (err, stdout, stderr) => {"
);

content = content.replace(
    "async function checkNPM(cancellationToken) {\n    const { stdout } = await exec('npm -v', {}, cancellationToken);\n    const version = stdout.trim();\n    if (/^3\\.7\\.[0123]$/.test(version)) {\n        throw new Error(`npm@${version} doesn't work with vsce. Please update npm: npm install -g npm`);\n    }\n}",
    "async function checkNPM(cancellationToken) {\n    try {\n        const { stdout } = await exec('npm -v', {}, cancellationToken);\n        const version = stdout.trim();\n        if (/^3\\.7\\.[0123]$/.test(version)) {\n            throw new Error(`npm@${version} doesn't work with vsce. Please update npm: npm install -g npm`);\n        }\n    } catch (err) {\n        if (err.message && err.message.includes(\"3.7.\")) throw err;\n    }\n}"
);

content = content.replace(
    ".then(() => exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024 }))\n        .then(({ stdout }) => stdout.split(/[\\r\\n]/).filter(dir => path.isAbsolute(dir)));",
    ".then(() => exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024, shell: true }))\n        .then(({ stdout }) => stdout.split(/[\\r\\n]/).filter(dir => path.isAbsolute(dir)))\n        .catch(() => [cwd]);"
);

fs.writeFileSync(npmJsPath, content);
console.log('vsce npm.js patched successfully');
