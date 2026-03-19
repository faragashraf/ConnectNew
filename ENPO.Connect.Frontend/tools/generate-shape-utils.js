const fs = require('fs');

function readFile(p) { return fs.readFileSync(p, 'utf8'); }

function parseInterfaces(src) {
    const ifaceRe = /export interface\s+(\w+)\s*{([\s\S]*?)^}/gm;
    // match property signatures like `name: type;` or `name?: type;`
    const propsRe = /([A-Za-z0-9_]+)\s*\??\s*:\s*([^;\n]+);/g;
    const interfaces = {};
    let m;
    while ((m = ifaceRe.exec(src)) !== null) {
        const name = m[1];
        const body = m[2];
        const props = {};
        let pm;
        while ((pm = propsRe.exec(body)) !== null) {
            const prop = pm[1];
            let type = pm[2].trim();
            type = type.split('|')[0].trim();
            props[prop] = type;
        }
        interfaces[name] = props;
    }
    return interfaces;
}

function parseControllerMethods(src) {
    const map = {};
    // Find the first exported class and use its body. This keeps the util generic
    // so it can work with different controller/service class names.
    const classRe = /export class\s+([A-Za-z0-9_]+)\s*{([\s\S]*?)^}/m;
    const classMatch = classRe.exec(src);
    if (!classMatch) return map;
    const body = classMatch[2];
    const methodRe = /^(\s*)([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*[^\{]+\{/gm;
    let mm;
    while ((mm = methodRe.exec(body)) !== null) {
        const name = mm[2];
        const paramsRaw = mm[3].trim();
        const params = [];
        if (paramsRaw) {
            const parts = paramsRaw.split(',').map(p => p.trim()).filter(Boolean);
            for (const p of parts) {
                const raw = p;
                const namePart = (raw.split(':')[0] || raw.split('=')[0] || raw).trim();
                const colonIdx = raw.indexOf(':');
                const after = colonIdx >= 0 ? raw.substring(colonIdx + 1).trim() : '';
                const cleaned = after.split('|')[0].split('=')[0].trim();
                const typeMatch = cleaned.match(/([A-Za-z0-9_<\>\[\]]+)/);
                const typeName = typeMatch ? typeMatch[1] : null;
                const isBody = namePart.toLowerCase() === 'body' || namePart.toLowerCase().endsWith('body');
                const isArray = /\[\]$/.test(cleaned) || /^Array<.+>$/.test(cleaned);
                params.push({ raw, name: namePart, type: typeName, isBody, isArray });
            }
        }
        map[name] = params;
    }
    return map;
}

function shapeForType(type, interfaces, seen) {
    if (!type) return '';
    if (type.endsWith('[]')) {
        const inner = type.replace(/\[\]$/, '');
        return [ shapeForType(inner, interfaces, seen) ];
    }
    if (/^Array<(.+)>$/i.test(type)) {
        const inner = type.replace(/^Array<(.+)>$/i, '$1');
        return [ shapeForType(inner, interfaces, seen) ];
    }
    const t = type.toLowerCase();
    if (t === 'string' || t === 'date' || t === 'any') return '';
    if (t === 'number') return 0;
    if (t === 'boolean') return false;
    if (interfaces[type] && !seen.has(type)) {
        seen.add(type);
        const obj = {};
        const props = interfaces[type];
        for (const k of Object.keys(props)) {
            obj[k] = shapeForType(props[k], interfaces, seen);
        }
        return obj;
    }
    return {};
}

function buildShapesFromSource(src) {
    const interfaces = parseInterfaces(src);
    const methods = parseControllerMethods(src);
    const shapes = {};
    for (const name of Object.keys(interfaces)) {
        shapes[name] = shapeForType(name, interfaces, new Set());
    }
    return { shapes, methods };
}

function buildShapesFromFile(filePath) {
    const src = readFile(filePath);
    return buildShapesFromSource(src);
}

module.exports = { parseInterfaces, parseControllerMethods, shapeForType, buildShapesFromSource, buildShapesFromFile };
