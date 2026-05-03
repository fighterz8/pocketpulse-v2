#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { analyzeClassificationExports, type ClassificationExportSnapshot } from "../server/classificationExportAnalysis.js";

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Usage: tsx scripts/analyze-classification-export.ts <export.json> [...export.json]");
  process.exit(1);
}

const snapshots = paths.map((path) => JSON.parse(readFileSync(path, "utf8")) as ClassificationExportSnapshot);
const analysis = analyzeClassificationExports(snapshots);

console.log(JSON.stringify(analysis, null, 2));
