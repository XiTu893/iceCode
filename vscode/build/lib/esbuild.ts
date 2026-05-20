/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as path from 'path';

const root = path.resolve(import.meta.dirname, '../..');

// esbuild-based bundle tasks (drop-in replacement for bundle-vscode / minify-vscode)

export function runEsbuildTranspile(outDir: string, excludeTests: boolean): Promise<void> {
	return new Promise((resolve, reject) => {
		const scriptPath = path.join(root, 'build/next/index.ts');
		const args = ['--experimental-strip-types', '--max-old-space-size=4096', scriptPath, 'transpile', '--out', outDir];
		if (excludeTests) {
			args.push('--exclude-tests');
		}

		const proc = cp.spawn(process.execPath, args, {
			cwd: root,
			stdio: 'inherit'
		});

		const TIMEOUT_MS = 10 * 60 * 1000;
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			console.error(`esbuild transpile timed out after ${TIMEOUT_MS / 1000}s (outDir: ${outDir}), killing...`);
			try {
				proc.kill('SIGKILL');
			} catch {
				// ignore
			}
		}, TIMEOUT_MS);

		proc.on('error', err => {
			clearTimeout(timer);
			reject(err);
		});
		proc.on('close', code => {
			clearTimeout(timer);
			if (timedOut) {
				reject(new Error(`esbuild transpile timed out after ${TIMEOUT_MS / 1000}s (outDir: ${outDir})`));
			} else if (code === 0) {
				resolve();
			} else {
				reject(new Error(`esbuild transpile failed with exit code ${code} (outDir: ${outDir})`));
			}
		});
	});
}

export function runEsbuildBundle(outDir: string, minify: boolean, nls: boolean, target: 'desktop' | 'server' | 'server-web' = 'desktop', sourceMapBaseUrl?: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const scriptPath = path.join(root, 'build/next/index.ts');
		const args = ['--experimental-strip-types', '--max-old-space-size=4096', scriptPath, 'bundle', '--out', outDir, '--target', target];
		if (minify) {
			args.push('--minify');
			args.push('--mangle-privates');
		}
		if (nls) {
			args.push('--nls');
		}
		if (sourceMapBaseUrl) {
			args.push('--source-map-base-url', sourceMapBaseUrl);
		}

		const proc = cp.spawn(process.execPath, args, {
			cwd: root,
			stdio: 'inherit'
		});

		const TIMEOUT_MS = 10 * 60 * 1000;
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			console.error(`esbuild bundle timed out after ${TIMEOUT_MS / 1000}s (outDir: ${outDir}, target: ${target}), killing...`);
			try {
				proc.kill('SIGKILL');
			} catch {
				// ignore
			}
		}, TIMEOUT_MS);

		proc.on('error', err => {
			clearTimeout(timer);
			reject(err);
		});
		proc.on('close', code => {
			clearTimeout(timer);
			if (timedOut) {
				reject(new Error(`esbuild bundle timed out after ${TIMEOUT_MS / 1000}s (outDir: ${outDir}, target: ${target})`));
			} else if (code === 0) {
				resolve();
			} else {
				reject(new Error(`esbuild bundle failed with exit code ${code} (outDir: ${outDir}, minify: ${minify}, nls: ${nls}, target: ${target})`));
			}
		});
	});
}
