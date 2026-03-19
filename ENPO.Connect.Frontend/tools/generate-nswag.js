const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const mappingFile = path.join(repoRoot, 'src', 'app', 'shared', 'services', 'Nswag', 'nswag-services.json');
const baseConfigPath = path.join(repoRoot, 'src', 'app', 'shared', 'services', 'Nswag', 'service.config.nswag');
const tmpDir = path.join(repoRoot, 'tmp', 'nswag');

if (!fs.existsSync(mappingFile)) {
  console.error('Mapping file not found:', mappingFile);
  process.exit(1);
}
if (!fs.existsSync(baseConfigPath)) {
  console.error('Base NSwag config not found:', baseConfigPath);
  process.exit(1);
}
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const VERBOSE = !!process.env.DEBUG_NSWAG;

let mappings;
let baseConfig;
try { mappings = JSON.parse(fs.readFileSync(mappingFile, 'utf8')); } catch (err) { console.error('Failed to read mapping', err); process.exit(1); }
try { baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, 'utf8')); } catch (err) { console.error('Failed to read base config', err); process.exit(1); }

function ensureSwaggerJsonUrl(url) {
  if (!url) return url;
  const lower = url.toLowerCase();
  if (lower.includes('swagger') || lower.endsWith('.json')) return url;
  return url.replace(/\/$/, '') + '/swagger/v1/swagger.json';
}

function findMatchingBrace(s, startPos) {
  let pos = startPos;
  let depth = 0;
  while (pos < s.length) {
    const ch = s[pos];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return pos + 1; // one past closing
    }
    pos++;
  }
  return -1;
}

function mergeImports(text) {
  const importRe = /^import\s+(.+)\s+from\s+(['"])([^'"\n]+)\2;?$/gm;
  const map = new Map();
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const spec = m[1].trim();
    const mod = m[3];
    if (!map.has(mod)) map.set(mod, { defaults: [], named: new Set() });
    const entry = map.get(mod);
    const named = spec.match(/^\{([\s\S]+)\}$/);
    if (named) {
      named[1].split(',').map(s => s.trim()).filter(Boolean).forEach(x => entry.named.add(x));
    } else {
      entry.defaults.push(spec);
    }
  }
  const merged = [];
  for (const [mod, entry] of map) {
    const def = entry.defaults.length ? entry.defaults[0] : null;
    const names = Array.from(entry.named);
    if (def && names.length) merged.push(`import ${def}, { ${names.join(', ')} } from '${mod}';`);
    else if (names.length) merged.push(`import { ${names.join(', ')} } from '${mod}';`);
    else if (def) merged.push(`import ${def} from '${mod}';`);
  }
  const cleaned = text.replace(importRe, '');
  return (merged.length ? merged.join('\n') + '\n\n' : '') + cleaned;
}

function extractDefs(content) {
  const defRe = /export\s+(interface|enum|type|class)\s+([A-Za-z0-9_]+)\b[\s\S]*?(?=\nexport\s+(?:interface|enum|type|class)\s+[A-Za-z0-9_]+\b|$)/g;
  const defs = new Map();
  let m;
  while ((m = defRe.exec(content)) !== null) {
    const name = m[2];
    defs.set(name, m[0]);
  }
  return defs;
}

(async () => {
  const results = [];
  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    let tmpFile = null;
    let generatedPath = null;
    // If mapping explicitly sets regenerate=false, skip generating this service
    if (m.regenerate === false) {
      console.log('\n== Skipping generation (regenerate=false):', m.label || `service${i}`);
      continue;
    }
    try {
      const cfg = JSON.parse(JSON.stringify(baseConfig));
      // Choose production URL when isproduction is true, otherwise use url/swaggerUrl
      let chosenUrl = '';
      if (m.isproduction === true && (m.urlProduction || m.url)) {
        chosenUrl = m.urlProduction || m.url;
      } else {
        chosenUrl = m.url || m.swaggerUrl || '';
      }
      const swaggerUrl = ensureSwaggerJsonUrl(chosenUrl);
      if (!swaggerUrl) { console.warn('No swagger url for', m); continue; }
      if (cfg.documentGenerator && cfg.documentGenerator.fromDocument) cfg.documentGenerator.fromDocument.url = swaggerUrl;
      if (cfg.codeGenerators && cfg.codeGenerators.openApiToTypeScriptClient) {
        const out = m.output;
        if (out) cfg.codeGenerators.openApiToTypeScriptClient.output = path.isAbsolute(out) ? out : path.join(repoRoot, out);
      }
      const safeLabel = (m.label || `service${i}`).replace(/[^a-z0-9\-_.]/gi, '_');
      tmpFile = path.join(tmpDir, `service.config.${safeLabel}.nswag`);
      fs.writeFileSync(tmpFile, JSON.stringify(cfg, null, 2), 'utf8');
      console.log('\n== Generating:', m.label || safeLabel);
      execSync(`npx nswag run "${tmpFile}"`, { stdio: 'inherit' });

      generatedPath = cfg && cfg.codeGenerators && cfg.codeGenerators.openApiToTypeScriptClient && cfg.codeGenerators.openApiToTypeScriptClient.output;
      if (!generatedPath) { console.warn('No output configured for', m); continue; }
      if (!fs.existsSync(generatedPath)) { console.warn('Generated file missing:', generatedPath); continue; }

      const genContent = fs.readFileSync(generatedPath, 'utf8');

      if (VERBOSE) console.log(`Generated file for ${m.label || safeLabel}: ${generatedPath} (${genContent.length} chars)`);

      const classRe = /export\s+class\s+(\w+Controller)\b/g;
      const classes = [];
      let match;
      while ((match = classRe.exec(genContent)) !== null) {
        const name = match[1];
        const classStart = match.index;
        const bracePos = genContent.indexOf('{', classStart);
        if (bracePos === -1) continue;
        const classEnd = findMatchingBrace(genContent, bracePos);
        if (classEnd === -1) continue;
        classes.push({ name, start: classStart, end: classEnd });
      }

      const firstClassStart = classes.length ? classes[0].start : genContent.length;
      const lastClassEnd = classes.length ? classes[classes.length - 1].end : 0;

      const topPart = genContent.slice(0, firstClassStart);

      const defsMap = extractDefs(genContent);
      if (VERBOSE) console.log(`  -> extracted ${defsMap.size} defs for ${m.label || safeLabel}`);
      const defsBlacklist = new Set(['ApiException', 'makeApiError', 'throwException', 'blobToText', 'InjectionToken', 'Observable']);
      for (const b of defsBlacklist) defsMap.delete(b);

      results.push({ label: m.label || safeLabel, safeLabel, genContent, classes, topPart, defsMap, output: generatedPath, envProperty: m.envProperty });

      try { fs.unlinkSync(generatedPath); } catch (e) { }
    } catch (err) {
      console.error('Error generating for', m.label || i, err && err.message || err);
    } finally {
      try { if (tmpFile) fs.unlinkSync(tmpFile); } catch (e) { }
    }
  }

  // Aggregate definitions across all generated results and create shared file
  const targetBase = path.join(repoRoot, 'src', 'app', 'shared', 'services', 'BackendServices');
  // const targetBase = path.join(repoRoot, 'src', 'app', 'shared', 'services', 'BackendServices', 'new');
  try { fs.mkdirSync(targetBase, { recursive: true }); } catch (e) { }
  const templatePath = path.join(repoRoot, 'src', 'app', 'shared', 'services', 'Nswag', 'templates', 'dto-shared.ts');
  const templateText = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : '';

  // Count occurrences of each definition across generated results.
  // Only defs that appear in more than one service (shared) will be emitted into dto-shared.ts.
  const defCounts = new Map();
  for (const r of results) {
    for (const [k, v] of r.defsMap) {
      const cur = defCounts.get(k) || { count: 0, def: v };
      cur.count += 1;
      // keep the first seen text for that def
      defCounts.set(k, cur);
    }
  }

  // If shared file already exists, read its defs so we keep them shared as well
  const sharedFilePath = path.join(targetBase, 'dto-shared.ts');
  const existingSharedDefs = new Map();
  if (fs.existsSync(sharedFilePath)) {
    try {
      const existing = fs.readFileSync(sharedFilePath, 'utf8');
      const existingDefs = extractDefs(existing);
      for (const [k, v] of existingDefs) existingSharedDefs.set(k, v);
    } catch (e) { }
  }

  // Best-practice: rebuild `dto-shared.ts` from the current run's data only
  // (non-destructive): create a timestamped backup of the existing shared file,
  // then consider only defs that appear in more than one generated result as shared.
  const globalDefs = new Map();
  for (const [k, entry] of defCounts) {
    if (entry.count > 1) globalDefs.set(k, entry.def);
  }

  // No backup created here per configuration (keep generation idempotent)

  if (VERBOSE) {
    console.log('Definition counts:');
    for (const [k, entry] of defCounts) console.log(`  ${k}: ${entry.count}`);
    console.log('Shared defs (count>1) will include:', Array.from(globalDefs.keys()).join(', '));
  }
  if (VERBOSE) {
    console.log('Definition counts:');
    for (const [k, entry] of defCounts) console.log(`  ${k}: ${entry.count}`);
    console.log('Shared defs will include:', Array.from(globalDefs.keys()).slice(0, 50).join(', '));
  }

  const defsBlacklist = new Set(['ApiException', 'makeApiError', 'throwException', 'blobToText', 'InjectionToken', 'Observable']);
  for (const b of defsBlacklist) globalDefs.delete(b);

  // Filter out controller-like definitions (controllers were sometimes captured).
  const controllerLike = /HttpClient|@Injectable\(|constructor\(|this\.http|request\(|process[A-Z]|processGet|processSave/;
  // Remove controller class names from globalDefs to avoid importing them from shared
  for (const [name, defText] of Array.from(globalDefs)) {
    if (/Controller$/.test(name) || controllerLike.test(defText)) globalDefs.delete(name);
  }
  const extraDefs = [];
  for (const [name, defText] of globalDefs) {
    const already = templateText.indexOf(`export interface ${name}`) !== -1 || templateText.indexOf(`export class ${name}`) !== -1 || templateText.indexOf(`export enum ${name}`) !== -1 || templateText.indexOf(`export type ${name}`) !== -1;
    if (!already) extraDefs.push(defText);
  }

  let sharedContent = templateText + '\n\n' + extraDefs.join('\n\n');
  sharedContent = mergeImports(sharedContent).replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(sharedFilePath, sharedContent, 'utf8');

  // Now emit per-controller files, importing shared types where appropriate
  const createdServices = new Set();
  for (const r of results) {
    // Remove local copies of shared helpers/constants from the top part so those live only in dto-shared
    let topPartClean = r.topPart || '';
    topPartClean = topPartClean.replace(/export\s+const\s+API_BASE_URL[\s\S]*?;\s*\n/gi, '');
    topPartClean = topPartClean.replace(/export\s+class\s+ApiException[\s\S]*?}\s*\n/gi, '');
    topPartClean = topPartClean.replace(/export\s+function\s+makeApiError[\s\S]*?}\s*\n/gi, '');
    topPartClean = topPartClean.replace(/export\s+function\s+throwException[\s\S]*?}\s*\n/gi, '');
    topPartClean = topPartClean.replace(/export\s+function\s+blobToText[\s\S]*?}\s*\n/gi, '');
    const topImports = mergeImports(topPartClean);
    for (const c of r.classes) {
      const shortName = c.name.replace(/Controller$/, '');
      const controllerDir = path.join(targetBase, shortName);
      try { fs.mkdirSync(controllerDir, { recursive: true }); } catch (e) { }
      const outFilePath = path.join(controllerDir, `${shortName}.service.ts`);
      const dtoFilePath = path.join(controllerDir, `${shortName}.dto.ts`);
      if (createdServices.has(outFilePath)) continue;

      let classBlock = r.genContent.slice(c.start, c.end);
      classBlock = classBlock.replace(/^\s*import .*$/gm, '');
      if (!/@Injectable\s*\(/.test(classBlock)) classBlock = '@Injectable({ providedIn: "root" })\n' + classBlock;

      // Collect capitalized identifiers from the class block (body + method signatures)
      const identRe = /\b([A-Z][A-Za-z0-9_]*)\b/g;

      // NEW: capture types used in method parameters and return types
      const methodTypeRe = /[:<]\s*([A-Z][A-Za-z0-9_]*)/g;

      const ignoreSet = new Set([
        'Observable', 'Promise', 'HttpResponse', 'HttpResponseBase', 'HttpHeaders',
        'Blob', 'FormData', 'String', 'Number', 'Boolean', 'Date', 'Array', 'any', 'void',
        'File', 'FileList', 'ReadonlyArray', 'Map', 'Set'
      ]);

      const needed = new Set();

      // 1️⃣ body identifiers (existing behavior)
      let mm;
      while ((mm = identRe.exec(classBlock)) !== null) {
        const tn = mm[1];
        if (ignoreSet.has(tn)) continue;
        if (r.defsMap.has(tn) || globalDefs.has(tn)) needed.add(tn);
      }

      // 2️⃣ method parameter + return types (🔥 FIX)
      let mt;
      while ((mt = methodTypeRe.exec(classBlock)) !== null) {
        const tn = mt[1];
        if (ignoreSet.has(tn)) continue;
        if (r.defsMap.has(tn) || globalDefs.has(tn)) needed.add(tn);
      }

      // 🔒 Always include Request DTOs (safety net)
      for (const [name] of r.defsMap) {
        if (name.endsWith('Request')) {
          needed.add(name);
        }
      }
      // Expand dependencies transitively from local defs
      const queue = Array.from(needed);
      while (queue.length) {
        const tn = queue.shift();
        const defText = r.defsMap.get(tn) || globalDefs.get(tn);
        if (!defText) continue;
        const tr = /\b([A-Z][A-Za-z0-9_]*)\b/g;
        let mm2;
        while ((mm2 = tr.exec(defText)) !== null) {
          const tn2 = mm2[1];
          if (!needed.has(tn2) && (r.defsMap.has(tn2) || globalDefs.has(tn2))) { needed.add(tn2); queue.push(tn2); }
        }
      }

      const typeImportFromShared = [];
      const typeImportLocal = [];
      function isDtoLike(name, defText) {
        if (!defText) return false;
        return /export\s+(interface|enum|type)\s+/.test(defText);
      }
      for (const tn of needed) {
        const sharedDef = globalDefs.get(tn);
        const localDef = r.defsMap.get(tn);
        if (sharedDef && isDtoLike(tn, sharedDef)) typeImportFromShared.push(tn);
        else if (localDef && isDtoLike(tn, localDef)) typeImportLocal.push(tn);
      }

      if (VERBOSE) console.log(`  Service ${shortName}: need ${needed.size} types; shared:${typeImportFromShared.length} local:${typeImportLocal.length}`);

      const helperImportNames = [];
      ['API_BASE_URL', 'throwException', 'blobToText', 'ApiException', 'FileParameter'].forEach(h => { if (classBlock.includes(h)) helperImportNames.push(h); });

      const typeImportStmt = typeImportFromShared.length ? `import { ${typeImportFromShared.join(', ')} } from '../dto-shared';\n` : '';
      const helperImportStmt = helperImportNames.length ? `import { ${helperImportNames.join(', ')} } from '../dto-shared';\n` : '';
      const localImportStmt = typeImportLocal.length ? `import { ${typeImportLocal.join(', ')} } from './${shortName}.dto';\n` : '';

      let assembled = mergeImports(topImports) + '\n' + typeImportStmt + helperImportStmt + localImportStmt + '\n' + classBlock;
      // If mapping specified an envProperty, import environment and use it as default baseUrl
      if (r.envProperty) {
        const envImportStmt = `import { environment } from 'src/environments/environment';\n`;
        if (!/^\s*import\s+\{\s*environment\s*\}/m.test(assembled)) assembled = envImportStmt + assembled;
        assembled = assembled.replace(/this\.baseUrl\s*=\s*baseUrl\s*!==\s*undefined\s*&&\s*baseUrl\s*!==\s*null\s*\?\s*baseUrl\s*:\s*(['"]).+?\1\s*;/g, `this.baseUrl = baseUrl !== undefined && baseUrl !== null ? baseUrl : environment.${r.envProperty};`);
      }
      const importLines = [];
      let rest = assembled.replace(/^import\s.+$/gm, (m) => { importLines.push(m); return ''; });
      // Remove stray local shared helper declarations that should live only in dto-shared
      rest = rest.replace(/export\s+const\s+API_BASE_URL[\s\S]*?;\s*\n/gi, '');
      rest = rest.replace(/export\s+class\s+ApiException[\s\S]*?}\s*\n/gi, '');
      rest = rest.replace(/export\s+function\s+makeApiError[\s\S]*?}\s*\n/gi, '');
      rest = rest.replace(/export\s+function\s+throwException[\s\S]*?}\s*\n/gi, '');
      rest = rest.replace(/export\s+function\s+blobToText[\s\S]*?}\s*\n/gi, '');
      // Remove stray standalone @Injectable() that may appear above imports
      rest = rest.replace(/^\s*@Injectable\(\)\s*(?:\r?\n|$)/gm, '');
      const mergedImports = mergeImports(importLines.join('\n'));
      const finalContent = (mergedImports + '\n\n' + rest).replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(outFilePath, finalContent, 'utf8');
      createdServices.add(outFilePath);

      // Write local dto file with defs that are not in shared
      const dtoDefs = [];
      const controllerLike = /HttpClient|@Injectable\(|constructor\(|this\.http|request\(|process[A-Z]|processGet|processSave/;
      for (const tn of typeImportLocal) {
        if (/Controller$/.test(tn)) continue;
        const dt = r.defsMap.get(tn);
        if (!dt) continue;
        if (controllerLike.test(dt)) continue;
        dtoDefs.push(dt);
      }
      // Synthesize DTOs for multipart/form-data methods when backend didn't expose a single request schema.
      try {
        const methodHeaderRe = /(\w+)\s*\(([^)]*)\)\s*:\s*Observable/g;
        let mh;
        while ((mh = methodHeaderRe.exec(classBlock)) !== null) {
          const methodName = mh[1];
          const paramsStr = mh[2] || '';
          // find method body to ensure it uses FormData
          const methodStart = mh.index;
          const bracePos = classBlock.indexOf('{', methodStart + mh[0].length);
          if (bracePos === -1) continue;
          const methodEnd = findMatchingBrace(classBlock, bracePos);
          if (methodEnd === -1) continue;
          const methodBody = classBlock.slice(bracePos, methodEnd);
          if (!/new\s+FormData\s*\(/.test(methodBody)) continue;

          const params = paramsStr.split(',').map(p => p.trim()).filter(Boolean);
          if (!params.length) continue;

          // derive a unique DTO name for multipart methods to avoid collisions
          // Use pattern: <Controller><Method>FormRequest (e.g. RepliesReplyWithAttachmentFormRequest)
          const firstParamName = params[0].split(':')[0].trim().replace(/\?$/, '');
          const methodPart = methodName.charAt(0).toUpperCase() + methodName.slice(1);
          const ctrlPart = shortName.replace(/Controller$/i, '');
          const dtoName = `${ctrlPart}${methodPart}FormRequest`;
          if (r.defsMap.has(dtoName) || globalDefs.has(dtoName)) continue;
          const fields = [];
          for (const p of params) {
            const parts = p.split(':');
            if (parts.length < 2) continue;
            let pname = parts[0].trim();
            let ptype = parts.slice(1).join(':').trim();
            const optional = /\|\s*undefined/.test(ptype) || /\?$/.test(pname);
            pname = pname.replace(/\?$/, '');
            // clean union with undefined
            ptype = ptype.replace(/\|\s*undefined/g, '').replace(/\s*\|\s*null/g, '').trim();
            // Normalize trailing = default values
            ptype = ptype.replace(/=\s*.*$/, '').trim();
            // Map common server-side form-file types to client FileParameter
            // Examples: IFormFile, IFormFile[], IEnumerable<IFormFile>, List<IFormFile>, IFormFileCollection
            try {
              const normalized = ptype.replace(/\s+/g, '');
              const isCollection = /IFormFile\[\]|IEnumerable<IFormFile>|ICollection<IFormFile>|IList<IFormFile>|List<IFormFile>|IFormFileCollection/i.test(normalized);
              if (/IFormFile\b/i.test(ptype) || /Microsoft\.AspNetCore\.Http\.IFormFile/i.test(ptype)) {
                ptype = isCollection ? 'FileParameter[]' : 'FileParameter';
              }
            } catch (e) {
              // non-fatal, keep original ptype
            }
            if (!ptype) ptype = 'any';
            fields.push(`${pname}${optional ? '?' : ''}: ${ptype};`);
          }
          if (fields.length) {
            const dtoText = `export interface ${dtoName} {\n  ${fields.join('\n  ')}\n}`;
            // Avoid duplicates
            if (!dtoDefs.includes(dtoText)) dtoDefs.push(dtoText);
          }
        }
      } catch (e) {
        if (VERBOSE) console.warn('Synthesis of multipart DTOs failed for', c.name, e && e.message || e);
      }
      if (VERBOSE) console.log(`  Writing ${dtoDefs.length} local DTO defs to ${dtoFilePath}`);
      let dtoContent = dtoDefs.join('\n\n');
      // Detect which shared defs are referenced by these local dto defs and import them
      const sharedUsed = new Set();
      if (dtoContent) {
        // Post-process synthesized DTO text: map server-side IFormFile types to FileParameter
        dtoContent = dtoContent.replace(/Microsoft\.AspNetCore\.Http\.IFormFile\b/g, 'FileParameter');
        dtoContent = dtoContent.replace(/IFormFile\b/g, 'FileParameter');
        dtoContent = dtoContent.replace(/IEnumerable<\s*IFormFile\s*>/g, 'FileParameter[]');
        dtoContent = dtoContent.replace(/ICollection<\s*IFormFile\s*>/g, 'FileParameter[]');
        dtoContent = dtoContent.replace(/IList<\s*IFormFile\s*>/g, 'FileParameter[]');
        dtoContent = dtoContent.replace(/List<\s*IFormFile\s*>/g, 'FileParameter[]');
        dtoContent = dtoContent.replace(/IFormFile\[\]/g, 'FileParameter[]');

        const idRe = /\b([A-Z][A-Za-z0-9_]*)\b/g;
        let mId;
        while ((mId = idRe.exec(dtoContent)) !== null) {
          const idName = mId[1];
          if (globalDefs.has(idName)) sharedUsed.add(idName);
        }
        // Ensure FileParameter is imported when used
        if (/\bFileParameter\b/.test(dtoContent)) sharedUsed.add('FileParameter');
      }
      if (sharedUsed.size) {
        const sharedList = Array.from(sharedUsed).join(', ');
        dtoContent = `import { ${sharedList} } from '../dto-shared';\n\n` + dtoContent;
      }
      if (/\bObservable\b/.test(dtoContent) && !/from\s+['"]rxjs['"]/.test(dtoContent)) dtoContent = "import { Observable } from 'rxjs';\n\n" + dtoContent;
      // Clean dto content from stray decorators or shared helper duplicates
      dtoContent = dtoContent.replace(/^\s*@Injectable\(\)\s*(?:\r?\n|$)/gm, '');
      dtoContent = dtoContent.replace(/export\s+const\s+API_BASE_URL[\s\S]*?;\s*\n/gi, '');
      dtoContent = dtoContent.replace(/export\s+class\s+ApiException[\s\S]*?}\s*\n/gi, '');
      dtoContent = dtoContent.replace(/export\s+function\s+makeApiError[\s\S]*?}\s*\n/gi, '');
      dtoContent = dtoContent.replace(/export\s+function\s+throwException[\s\S]*?}\s*\n/gi, '');
      dtoContent = dtoContent.replace(/export\s+function\s+blobToText[\s\S]*?}\s*\n/gi, '');
      dtoContent = dtoContent.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(dtoFilePath, dtoContent, 'utf8');
    }
  }

  console.log('\nAll done.');
})();