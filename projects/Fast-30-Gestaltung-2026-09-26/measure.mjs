// Textbreite in Arial Bold (Referenzschnitt laut DESIGN.md 3). Aufruf: node measure.mjs "Text" 46
import * as fontkit from 'fontkit';
const font = fontkit.openSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const [text, size = '46'] = process.argv.slice(2);
const w = font.layout(text).positions.reduce((s, p) => s + p.xAdvance, 0) / font.unitsPerEm * Number(size);
console.log(JSON.stringify({ text, size: Number(size), width: Math.round(w * 10) / 10 }));
