#!/usr/bin/env node

/**
 * Codama client generation script
 * Converts Anchor IDL → Codama → TypeScript client
 * 
 * Usage: node scripts/generate-client.mjs
 * Requires: anchor build to have run first (produces target/idl/*.json)
 */

import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderJavaScriptVisitor } from '@codama/renderers-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Find IDL files from anchor build
const idlDir = join(projectRoot, 'target', 'idl');
const outputDir = join(projectRoot, 'clients', 'ts');

const programs = [
  { name: 'agent_agreement_protocol', idlFile: 'agent_agreement_protocol.json' },
];

for (const program of programs) {
  const idlPath = join(idlDir, program.idlFile);
  
  if (!existsSync(idlPath)) {
    console.log(`⏭  Skipping ${program.name} — IDL not found at ${idlPath}`);
    console.log(`   Run 'anchor build' first to generate the IDL.`);
    continue;
  }

  console.log(`📦 Generating client for ${program.name}...`);
  
  const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));
  const rootNode = rootNodeFromAnchor(idl);
  const codama = createFromRoot(rootNode);
  
  const clientDir = join(outputDir, program.name);
  codama.accept(renderJavaScriptVisitor(clientDir));
  
  console.log(`✅ Generated TypeScript client at ${clientDir}`);
}

console.log('\nDone! Generated clients are in clients/ts/');
