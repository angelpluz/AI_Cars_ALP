#!/usr/bin/env bun
/**
 * Script สำหรับ Reset และ Ingest ข้อมูลใหม่เข้า RAG
 * Usage: bun run scripts/reset-and-ingest.ts [command] [options]
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { embedTexts } from '../embed';
import { VECTOR_LENGTH } from '../embed';
import { upsertChunks, deleteDataset, listDatasets, type StoredChunk } from '../ragStore';
import { chunkText } from '../rag';

const DATA_DIR = resolve(process.env.RAG_DATA_DIR ?? 'rag-data');
const RAW_DIR = join(DATA_DIR, 'raw');

interface IngestOptions {
  dataset?: string;
  sourceUrl?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  batchSize?: number;
}

function printUsage() {
  console.log(`
Usage: bun run scripts/reset-and-ingest.ts <command> [options]

Commands:
  reset-all                 ลบทุก datasets
  reset <dataset>           ลบ dataset ที่ระบุ
  ingest-file <path>        Ingest ไฟล์ (txt, md, json)
  ingest-dir <dir>          Ingest ทุกไฟล์ใน directory
  status                    แสดง status ของทุก datasets
  reindex                   Reindex ทุก datasets (สำหรับอัปเดต embeddings)

Options:
  --dataset <name>          ชื่อ dataset (default: ใช้ชื่อไฟล์)
  --source-url <url>        ระบุ source URL
  --chunk-size <n>          ขนาด chunk (default: 800)
  --chunk-overlap <n>       ขนาด overlap (default: 200)
  --batch-size <n>          Batch size สำหรับ embedding (default: 50)

Examples:
  bun run scripts/reset-and-ingest.ts reset-all
  bun run scripts/reset-and-ingest.ts reset cars-lineup
  bun run scripts/reset-and-ingest.ts ingest-file rag-data/raw/cars.txt --dataset cars-lineup
  bun run scripts/reset-and-ingest.ts ingest-dir rag-data/raw --batch-size 20
  bun run scripts/reset-and-ingest.ts status
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const options = parseOptions(args.slice(1));

  try {
    switch (command) {
      case 'reset-all':
        await resetAll();
        break;
      case 'reset':
        if (!args[1]) {
          console.error('Error: ต้องระบุชื่อ dataset');
          process.exit(1);
        }
        await resetDataset(args[1]);
        break;
      case 'ingest-file':
        if (!args[1]) {
          console.error('Error: ต้องระบุ path ของไฟล์');
          process.exit(1);
        }
        await ingestFile(args[1], options);
        break;
      case 'ingest-dir':
        if (!args[1]) {
          console.error('Error: ต้องระบุ directory');
          process.exit(1);
        }
        await ingestDirectory(args[1], options);
        break;
      case 'status':
        await showStatus();
        break;
      case 'reindex':
        await reindexAll();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function parseOptions(args: string[]): Required<IngestOptions> {
  const options: Required<IngestOptions> = {
    dataset: '',
    sourceUrl: '',
    chunkSize: 800,
    chunkOverlap: 200,
    batchSize: 50,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dataset':
        options.dataset = args[++i] ?? '';
        break;
      case '--source-url':
        options.sourceUrl = args[++i] ?? '';
        break;
      case '--chunk-size':
        options.chunkSize = parseInt(args[++i] ?? '800', 10);
        break;
      case '--chunk-overlap':
        options.chunkOverlap = parseInt(args[++i] ?? '200', 10);
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i] ?? '50', 10);
        break;
    }
  }

  return options;
}

async function resetAll() {
  const datasets = listDatasets();
  console.log(`Found ${datasets.length} datasets to delete...`);
  
  for (const dataset of datasets) {
    console.log(`  Deleting: ${dataset}`);
    deleteDataset(dataset);
  }
  
  console.log('✅ All datasets deleted');
}

async function resetDataset(dataset: string) {
  console.log(`Deleting dataset: ${dataset}...`);
  const success = deleteDataset(dataset);
  if (success) {
    console.log('✅ Deleted successfully');
  } else {
    console.log('⚠️ Dataset not found or already deleted');
  }
}

async function ingestFile(filePath: string, options: Required<IngestOptions>) {
  const fullPath = resolve(filePath);
  const stats = statSync(fullPath);
  
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  const datasetName = options.dataset || getDatasetNameFromPath(filePath);
  console.log(`Ingesting: ${filePath}`);
  console.log(`  Dataset: ${datasetName}`);
  console.log(`  Chunk size: ${options.chunkSize}, Overlap: ${options.chunkOverlap}`);

  const content = readFileSync(fullPath, 'utf-8');
  const ext = filePath.split('.').pop()?.toLowerCase();

  let chunks: string[];
  
  if (ext === 'json') {
    // รองรับ JSON หลาย formats
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      // Array of objects
      chunks = parsed.map(item => {
        if (typeof item === 'string') return item;
        // รวมทุก fields ที่เป็น text
        return Object.entries(item)
          .filter(([_, v]) => typeof v === 'string')
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      });
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Single object
      chunks = [JSON.stringify(parsed, null, 2)];
    } else {
      chunks = [String(parsed)];
    }
  } else {
    // Text file (txt, md, etc.)
    chunks = chunkText(content, options.chunkSize, options.chunkOverlap);
  }

  console.log(`  Created ${chunks.length} chunks`);

  if (chunks.length === 0) {
    console.log('⚠️ No chunks to ingest');
    return;
  }

  // Generate embeddings แบบ batch
  const embeddings = await generateEmbeddingsBatch(chunks, options.batchSize || 50);
  
  const storedChunks: StoredChunk[] = chunks.map((text, i) => ({
    dataset: datasetName,
    text,
    sourceUrl: options.sourceUrl || undefined,
    embedding: embeddings[i] || [],
  })).filter(c => c.embedding.length === VECTOR_LENGTH);

  if (!storedChunks.length) {
    console.log('⚠️ No valid embeddings generated');
    return;
  }

  const result = upsertChunks(datasetName, storedChunks);
  console.log(`✅ Ingested ${result.length} chunks into "${datasetName}"`);
}

async function ingestDirectory(dirPath: string, options: Required<IngestOptions>) {
  const fullPath = resolve(dirPath);
  const entries = readdirSync(fullPath, { withFileTypes: true });
  
  const files = entries
    .filter(e => e.isFile())
    .filter(e => ['.txt', '.md', '.json'].some(ext => e.name.endsWith(ext)))
    .map(e => join(fullPath, e.name));

  console.log(`Found ${files.length} files in ${dirPath}`);

  for (const file of files) {
    console.log('');
    const fileOptions = { ...options };
    if (!fileOptions.dataset) {
      fileOptions.dataset = getDatasetNameFromPath(file);
    }
    try {
      await ingestFile(file, fileOptions);
    } catch (error) {
      console.error(`  ❌ Failed: ${error}`);
    }
  }
}

async function showStatus() {
  const datasets = listDatasets();
  
  if (datasets.length === 0) {
    console.log('No datasets found');
    return;
  }

  console.log('\n📊 Dataset Status\n');
  console.log('Dataset Name                | Chunks | Tokens | Index Size');
  console.log('-'.repeat(60));

  for (const dataset of datasets.sort()) {
    const { getDatasetStats } = await import('../ragStore');
    const stats = getDatasetStats(dataset);
    if (stats) {
      const name = dataset.padEnd(27);
      const chunks = String(stats.chunks).padStart(6);
      const tokens = String(stats.tokens).padStart(6);
      const size = String(stats.size).padStart(10);
      console.log(`${name} | ${chunks} | ${tokens} | ${size}`);
    }
  }
  console.log('');
}

async function reindexAll() {
  console.log('Reindexing all datasets...');
  console.log('⚠️ Note: Reindexing requires re-generating embeddings with OpenAI API');
  console.log('This may take a while and consume API credits.\n');
  
  // Implementation สำหรับ reindex ถ้าต้องการอัปเดต embeddings
  console.log('Not implemented yet - use ingest-file/ingest-dir to re-ingest');
}

function getDatasetNameFromPath(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() || 'dataset';
  return base.replace(/\.(txt|md|json)$/i, '').toLowerCase().replace(/\s+/g, '-');
}

async function generateEmbeddingsBatch(texts: string[], batchSize: number): Promise<number[][]> {
  const { embedTexts } = await import('../embed');
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} items)`);
    
    const batchEmbeddings = await embedTexts(batch);
    embeddings.push(...batchEmbeddings);
    
    // Small delay to avoid rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return embeddings;
}

main();
