const fs = require('fs');
const path = require('path');

const moduleRoot = path.resolve(__dirname, '../src/app/Modules/EmployeeRequests');
const allowedExtensions = new Set(['.ts', '.html', '.scss']);

const excludedRelativePaths = new Set([
  'components/summer-requests-workspace/summer-requests-workspace.utils.ts'
]);

const suspiciousQuestionMarks = /\?{4,}/;
const suspiciousReplacement = /\uFFFD/;
const suspiciousMojibakeToken = /(\u00D8.|\u00D9.|\u00C3.|\u00D0.|\u00EF\u00BF\u00BD)/g;

function walkFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, files);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (allowedExtensions.has(ext)) {
      files.push(absolute);
    }
  }

  return files;
}

function isExcludedFile(filePath) {
  const relative = path.relative(moduleRoot, filePath).replace(/\\/g, '/');
  return excludedRelativePaths.has(relative);
}

function analyzeFile(filePath) {
  if (isExcludedFile(filePath)) {
    return [];
  }

  const findings = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const relative = path.relative(moduleRoot, filePath).replace(/\\/g, '/');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (suspiciousQuestionMarks.test(line)) {
      findings.push({
        file: relative,
        line: lineNumber,
        reason: 'contains long run of question marks (????)'
      });
    }

    if (suspiciousReplacement.test(line)) {
      findings.push({
        file: relative,
        line: lineNumber,
        reason: 'contains replacement character (U+FFFD)'
      });
    }

    const mojibakeMatches = line.match(suspiciousMojibakeToken) || [];
    if (mojibakeMatches.length >= 3) {
      findings.push({
        file: relative,
        line: lineNumber,
        reason: 'contains suspicious mojibake tokens (Ø/Ù/Ã/Ð)'
      });
    }
  });

  return findings;
}

function main() {
  if (!fs.existsSync(moduleRoot)) {
    console.error(`Target path not found: ${moduleRoot}`);
    process.exit(1);
  }

  const files = walkFiles(moduleRoot);
  const findings = files.flatMap(analyzeFile);

  if (findings.length === 0) {
    console.log('Text encoding integrity check passed.');
    return;
  }

  console.error('Text encoding integrity check failed. Suspicious lines:');
  findings.forEach(item => {
    console.error(`- ${item.file}:${item.line} -> ${item.reason}`);
  });
  process.exit(1);
}

main();
