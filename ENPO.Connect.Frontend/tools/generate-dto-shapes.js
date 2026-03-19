const fs = require('fs');
const path = require('path');
const utils = require('./generate-shape-utils');

// Generic DTO shapes generator.
// Usage:
// node generate-dto-shapes.js --input <file.ts> --output <out.json> --ts-output <out.ts>
// or to process all first-level service files in BackendServices:
// node generate-dto-shapes.js --input-dir <services-dir> --assets-dir <assets-dir> --ts-dir <ts-output-dir>

const argv = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return fallback;
}

// default: do NOT write assets JSON output; enable with --assets
const writeAssets = argv.indexOf('--assets') >= 0;

const defaultServicesDir = path.resolve(__dirname, '../src/app/shared/services/BackendServices');
const defaultTsDir = path.resolve(__dirname, '../src/app/shared/services/BackendServices/DtoShapes');
const defaultAssetsOut = path.resolve(__dirname, '../src/assets/publications-dto-shapes.json');

const inputDir = getArg('--input-dir', getArg('--inputDir', defaultServicesDir));
const tsDir = path.resolve(getArg('--ts-dir', defaultTsDir));
const assetsOut = path.resolve(getArg('--assets-out', getArg('--assets-dir', defaultAssetsOut)));

function processFile(filePath, tsDir) {
  const result = utils.buildShapesFromFile(filePath);
  const shapes = result.shapes || {};
  const methods = result.methods || {};
  const out = Object.assign({ __methodParamMap: methods }, shapes);

  const base = path.basename(filePath, path.extname(filePath)).replace(/\.service$/i, '');
  const tsOut = path.join(tsDir, `${base.toLowerCase()}-dto-shapes.ts`);

  // NOTE: per-service TypeScript modules are no longer emitted here to avoid
  // duplicate dto-shape sources (keep combined TS + assets JSON only).

  // also write per-service JSON to assets/dto-shapes/<base>-dto-shapes.json for runtime lazy-load
  const assetsDir = path.resolve(__dirname, '../src/assets/dto-shapes');
  if (writeAssets) {
    try {
      fs.mkdirSync(assetsDir, { recursive: true });
      const jsonOutPer = path.join(assetsDir, `${base.toLowerCase()}-dto-shapes.json`);
      fs.writeFileSync(jsonOutPer, JSON.stringify(out, null, 2), 'utf8');
      console.log('Wrote', jsonOutPer);
    } catch (e) {
      console.warn('Failed to write per-service JSON for', filePath, e && e.message ? e.message : e);
    }
  }

  // additionally, try to detect exported class name(s) in the source and write JSON files
  if (writeAssets) {
    try {
      const src = fs.readFileSync(filePath, 'utf8');
      const classMatches = [];
      const classRe = /export\s+class\s+([A-Za-z0-9_]+)/g;
      let m;
      while ((m = classRe.exec(src)) !== null) {
        if (m[1]) classMatches.push(m[1]);
      }
      for (const cls of classMatches) {
        // Skip certain internal/generated classes (e.g. ApiException) from per-class JSONs
        if (/^ApiException$/i.test(cls)) continue;
        try {
          const nameLower = cls.toLowerCase();
          const outPath = path.join(assetsDir, `${nameLower}-dto-shapes.json`);
          fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
          console.log('Wrote', outPath);
          // also write stripped variant (remove common suffixes)
          const stripped = cls.replace(/Controller$/i, '').replace(/Service$/i, '').replace(/Api$/i, '');
          if (stripped && stripped.toLowerCase() !== nameLower) {
            const outPath2 = path.join(assetsDir, `${stripped.toLowerCase()}-dto-shapes.json`);
            fs.writeFileSync(outPath2, JSON.stringify(out, null, 2), 'utf8');
            console.log('Wrote', outPath2);
          }
        } catch (e) { /* ignore per-class write errors */ }
      }
    } catch (e) { /* ignore */ }
  }

  return out;
}

function main() {
  // process all .ts files in the services directory and its subfolders
  function walkFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.resolve(dir, e.name);
      // skip generated shapes output directory if it exists inside services
      if (tsDir && (full === tsDir || full.startsWith(tsDir + path.sep))) continue;
      if (e.isFile()) {
        if (full.endsWith('.ts')) results.push(full);
      } else if (e.isDirectory()) {
        results.push(...walkFiles(full));
      }
    }
    return results;
  }

  const files = walkFiles(inputDir);

  // combined collector
  const combined = {};
  combined.__methodParamMap = {};

  for (const f of files) {
    try {
      const out = processFile(f, tsDir);
      // merge into combined (method maps merged specially)
      if (out && out.__methodParamMap) Object.assign(combined.__methodParamMap, out.__methodParamMap);
      // shallow merge shapes without overwriting existing keys (prefer earlier files)
      for (const k of Object.keys(out || {})) {
        if (!combined.hasOwnProperty(k)) combined[k] = out[k];
      }
    } catch (e) {
      console.warn('Error processing', f, e && e.message ? e.message : e);
    }
  }

  // write combined TS module and index file and assets JSON
  try {
    fs.mkdirSync(tsDir, { recursive: true });
    const combinedTs = path.join(tsDir, `combined-dto-shapes.ts`);
    const dtoTs = path.join(tsDir, `dto-shapes.ts`);
    const indexTs = path.join(tsDir, `index.ts`);
    const jsonOut = assetsOut;

    const tsContent = `// Auto-generated combined DTO shapes\nexport const DTO_SHAPES: any = ${JSON.stringify(combined, null, 2)};\nexport default DTO_SHAPES;\n`;
    fs.writeFileSync(combinedTs, tsContent, 'utf8');
    fs.writeFileSync(dtoTs, tsContent, 'utf8');
    // index re-exports default
    const idxContent = `export { DTO_SHAPES } from './combined-dto-shapes';\nexport { default } from './combined-dto-shapes';\n`;
    fs.writeFileSync(indexTs, idxContent, 'utf8');
    // write JSON to assets (fallback for runtime)
    if (writeAssets) {
      try {
        fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
        fs.writeFileSync(jsonOut, JSON.stringify(combined, null, 2), 'utf8');
      } catch (e) {
        console.warn('Failed to write assets JSON', e && e.message ? e.message : e);
      }
    }

    console.log('Wrote combined DTO shapes to', combinedTs);
  } catch (e) {
    console.warn('Failed to write combined DTO shapes', e && e.message ? e.message : e);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('Generator failed:', e && e.message ? e.message : e); process.exit(1); }
} else {
  module.exports = { main, processFile };
}
