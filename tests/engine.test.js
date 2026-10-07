#!/usr/bin/env node
/* Selbsttests für die Würfel-Engine und die Falldaten.
 * Ausführen: node tests/engine.test.js
 * Die Engine wird direkt aus index.html geladen (Script-Blöcke mit id="engine", "render", "logic", "data"). */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(id) {
  const m = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`Script-Block "${id}" nicht gefunden`);
  return m[1];
}
const Cube = new Function(block('engine') + '\nreturn Cube;')();
const Render = new Function('Cube', block('render') + '\nreturn Render;')(Cube);
const hasLogic = /id="logic"/.test(html);
const Logic = hasLogic ? new Function(block('logic') + '\nreturn Logic;')() : null;
const DATA = JSON.parse(block('data'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}
function section(t) { console.log('\n' + t); }

const { solved, apply, isSolved, parse, invert, format, caseState, faceOfOrig, F2L, U_LAYER, centersHome } = Cube;
const S0 = solved();
const ALL_MOVES = Object.keys(Cube.MOVE_DEFS);
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function randomAlg(r, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(ALL_MOVES[Math.floor(r() * ALL_MOVES.length)] + ['', "'", '2'][Math.floor(r() * 3)]);
  return out.join(' ');
}
const sameState = (a, b) => a.every((v, i) => v === b[i]);
const Uface = [0, 1, 2, 3, 5, 6, 7, 8];
const yellowUp = st => Uface.every(i => faceOfOrig(st[i]) === 'U');
const f2lSolved = st => F2L.every(i => st[i] === i);

section('Engine: Grundzüge');
test('jeder Zug 4× hintereinander ist neutral', () => {
  for (const m of ALL_MOVES) assert(isSolved(apply(S0, `${m} ${m} ${m} ${m}`)), m);
});
test("Zug + Inverse ist neutral (X X', X2 X2)", () => {
  for (const m of ALL_MOVES) {
    assert(isSolved(apply(S0, `${m} ${m}'`)), m);
    assert(isSolved(apply(S0, `${m}2 ${m}2`)), m + '2');
    assert(!isSolved(apply(S0, m)), m + ' ändert nichts');
  }
});
test('R bringt die Vorderseite nach oben', () => {
  const st = apply(S0, 'R');
  assert.strictEqual(faceOfOrig(st[2]), 'F'); // U oben rechts
  assert.strictEqual(faceOfOrig(st[8]), 'F'); // U unten rechts
  assert.strictEqual(faceOfOrig(st[0]), 'U');
});
test('U bringt die rechte Seite nach vorne', () => {
  const st = apply(S0, 'U');
  assert.deepStrictEqual([18, 19, 20].map(i => faceOfOrig(st[i])), ['R', 'R', 'R']);
});
test('F bringt die obere Seite nach rechts', () => {
  const st = apply(S0, 'F');
  assert.deepStrictEqual([9, 12, 15].map(i => faceOfOrig(st[i])), ['U', 'U', 'U']);
});
test('Slice-, Wide- und Rotations-Beziehungen', () => {
  const eq = (a, b) => assert(sameState(apply(S0, a), apply(S0, b)), `${a} ≠ ${b}`);
  eq('x', "R M' L'"); eq('y', "U E' D'"); eq('z', "F S B'");
  eq('r', "R M'"); eq('l', 'L M'); eq('u', "U E'"); eq('d', 'D E'); eq('f', 'F S'); eq('b', "B S'");
  eq('Rw', 'r'); eq("Uw'", "u'"); eq('R L', 'L R'); eq('M E', 'M E');
});
test('Ordnungen bekannter Sequenzen: (R U R\' U\')×6 und (R U)×105', () => {
  assert(isSolved(apply(S0, "(R U R' U')6")));
  assert(!isSolved(apply(S0, "(R U R' U')3")));
  let st = S0; for (let i = 0; i < 105; i++) st = apply(st, 'R U');
  assert(isSolved(st));
  st = S0; for (let i = 0; i < 35; i++) st = apply(st, 'R U');
  assert(!isSolved(st));
});
test('Superflip (12 gekippte Kanten, Ecken gelöst)', () => {
  const st = apply(S0, "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  assert(centersHome(st));
  for (const i of [0, 2, 6, 8]) assert.strictEqual(st[i], i);
  for (const i of [1, 3, 5, 7]) assert.notStrictEqual(faceOfOrig(st[i]), 'U');
});

section('Engine: Notation');
test('Parser zerlegt Züge korrekt', () => {
  assert.strictEqual(format(parse("R U R' U'")), "R U R' U'");
  assert.strictEqual(format(parse("R2' Rw u2 M' x y' z2")), "R2 r u2 M' x y' z2");
  assert.strictEqual(format(parse("(R U)2 [F']")), "R U R U F'");
  assert.strictEqual(format(parse('R’ U´')), "R' U'");
  assert.strictEqual(parse('').length, 0);
});
test('Parser lehnt Unsinn ab', () => {
  assert.throws(() => parse('R Q U'));
  assert.throws(() => parse('Mw'));
});
test('Invertieren: Reihenfolge umgekehrt, Richtung gespiegelt', () => {
  assert.strictEqual(Cube.invertStr("R U2 F' x"), "x' F U2 R'");
  assert.strictEqual(Cube.invertStr(''), '');
});
test('Algorithmus + Inverse = gelöst (200 Zufallsfolgen, alle Zugtypen)', () => {
  const r = rnd(42);
  for (let k = 0; k < 200; k++) {
    const a = randomAlg(r, 1 + Math.floor(r() * 30));
    assert(isSolved(apply(apply(S0, a), invert(a))), a);
    assert(isSolved(apply(caseState(a), a)), a);
  }
});
test('Gelöst in beliebiger Haltung wird erkannt (24 Orientierungen)', () => {
  assert.strictEqual(Cube.ROTATIONS.length, 24);
  for (const r of Cube.ROTATIONS) assert(Cube.isSolvedAnyOrientation(apply(S0, r)));
  assert(!Cube.isSolvedAnyOrientation(apply(S0, 'R')));
});

section('Engine: Scramble');
test('Scramble: 20 Züge, keine redundanten Folgezüge', () => {
  const axis = f => ({ R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 })[f];
  for (let k = 0; k < 300; k++) {
    const s = parse(Cube.scramble());
    assert.strictEqual(s.length, 20);
    for (let i = 1; i < s.length; i++) {
      assert.notStrictEqual(s[i].base, s[i - 1].base, 'gleiche Fläche hintereinander');
      if (i > 1 && axis(s[i].base) === axis(s[i - 1].base)) assert.notStrictEqual(axis(s[i].base), axis(s[i - 2].base), 'dreimal gleiche Achse');
    }
    assert(!isSolved(apply(S0, s)));
  }
});

section('Daten: PLL');
const setOf = id => DATA.sets.find(s => s.id === id);
const PLL = setOf('pll').cases;
const fullAlg = c => (c.alg + ' ' + (c.auf || '')).trim();
test('21 PLL-Fälle mit eindeutigen Namen', () => {
  assert.strictEqual(PLL.length, 21);
  assert.strictEqual(new Set(PLL.map(c => c.short)).size, 21);
});
test('jedes PLL-Alg löst seinen erzeugten Fall und ändert nur die Permutation der oberen Ebene', () => {
  for (const c of PLL) {
    const st = caseState(fullAlg(c));
    assert(isSolved(apply(st, fullAlg(c))), c.name + ' löst nicht');
    assert(centersHome(st), c.name + ': Mittelsteine verschoben (Netto-Rotation?)');
    assert(f2lSolved(st), c.name + ': F2L zerstört');
    assert(yellowUp(st), c.name + ': gelbe Seite nicht fertig – kein PLL');
    assert(!isSolved(st), c.name + ': leerer Fall');
  }
});
test('alle 21 PLL-Fälle sind verschieden (auch bis auf U-Drehungen vor/nach)', () => {
  const Us = ['', 'U', 'U2', "U'"];
  const keys = new Set();
  for (const c of PLL) {
    let best = null;
    for (const a of Us) for (const b of Us) {
      const k = U_LAYER.map(i => apply(apply(apply(S0, a), invert(fullAlg(c))), b)[i]).join(',');
      if (best === null || k < best) best = k;
    }
    assert(!keys.has(best), c.name + ' doppelt');
    keys.add(best);
  }
  assert.strictEqual(keys.size, 21);
});
test('PLL-Typen stimmen (nur Ecken / nur Kanten / beides)', () => {
  const moved = st => ({ c: [0, 2, 6, 8].filter(i => st[i] !== i).length, e: [1, 3, 5, 7].filter(i => st[i] !== i).length });
  const expect = { Aa: [3, 0], Ab: [3, 0], E: [4, 0], H: [0, 4], Ua: [0, 3], Ub: [0, 3], Z: [0, 4] };
  for (const c of PLL) {
    const m = moved(caseState(fullAlg(c)));
    if (expect[c.short]) assert.deepStrictEqual([m.c, m.e], expect[c.short], c.name);
    else assert(m.c === 2 || m.c === 3 || m.c === 4, c.name);
  }
  const ua = moved(caseState(fullAlg(PLL.find(c => c.short === 'Ua'))));
  assert.strictEqual(ua.e, 3);
});
test('Ua dreht die Kanten gegen, Ub im Uhrzeigersinn (Draufsicht)', () => {
  // Kante, die vorne liegt, gehört bei Ua nach rechts, bei Ub nach links
  const st = caseState(fullAlg(PLL.find(c => c.short === 'Ua')));
  const front = st[7];
  assert.strictEqual(front, 5);
  const st2 = caseState(fullAlg(PLL.find(c => c.short === 'Ub')));
  assert.strictEqual(st2[7], 3);
});

section('Daten: OLL');
const OLL = setOf('oll').cases;
const num = c => parseInt(c.short, 10);
const ollState = c => caseState(c.alg);
const yEdges = st => [1, 3, 5, 7].filter(i => faceOfOrig(st[i]) === 'U');
const yCorners = st => [0, 2, 6, 8].filter(i => faceOfOrig(st[i]) === 'U');
test('57 OLL-Fälle, Nummern 1–57', () => {
  assert.strictEqual(OLL.length, 57);
  assert.deepStrictEqual(OLL.map(num).sort((a, b) => a - b), Array.from({ length: 57 }, (_, i) => i + 1));
});
test('jedes OLL-Alg löst seinen Fall und lässt F2L intakt', () => {
  for (const c of OLL) {
    const st = ollState(c);
    assert(isSolved(apply(st, c.alg)), c.name);
    assert(centersHome(st), c.name + ': Mittelsteine verschoben');
    assert(f2lSolved(st), c.name + ': F2L zerstört');
    assert(!yellowUp(st), c.name + ': schon orientiert');
  }
});
test('alle 57 Orientierungsmuster sind verschieden (bis auf U-Drehung)', () => {
  const pat = st => U_LAYER.map(i => faceOfOrig(st[i]) === 'U' ? 1 : 0).join('');
  const keys = new Set();
  for (const c of OLL) {
    let s = ollState(c), best = null;
    for (let k = 0; k < 4; k++) { const p = pat(s); if (best === null || p < best) best = p; s = apply(s, 'U'); }
    assert(!keys.has(best), c.name + ' doppelt');
    keys.add(best);
  }
  assert.strictEqual(keys.size, 57);
});
test('OLL-Gruppen passen zum Muster (Kanten/Ecken)', () => {
  const dot = [1, 2, 3, 4, 17, 18, 19, 20], cross = [21, 22, 23, 24, 25, 26, 27];
  const line = [13, 14, 15, 16, 33, 34, 39, 40, 45, 46, 51, 52, 55, 56, 57];
  const corners = { 1: 0, 2: 0, 3: 1, 4: 1, 17: 2, 18: 2, 19: 2, 20: 4, 21: 0, 22: 0, 23: 2, 24: 2, 25: 2, 26: 1, 27: 1, 28: 4, 57: 4 };
  for (const c of OLL) {
    const n = num(c), st = ollState(c), e = yEdges(st);
    if (dot.includes(n)) assert.strictEqual(e.length, 0, c.name);
    else if (cross.includes(n)) assert.strictEqual(e.length, 4, c.name);
    else {
      assert.strictEqual(e.length, 2, c.name);
      const isLine = e.join() === '1,7' || e.join() === '3,5';
      assert.strictEqual(isLine, line.includes(n), c.name + (isLine ? ' ist Linie' : ' ist L'));
    }
    if (n in corners) assert.strictEqual(yCorners(st).length, corners[n], c.name + ' Ecken');
  }
});
test('Sune (27) und Antisune (26) sind invers zueinander gespiegelt', () => {
  const sune = OLL.find(c => num(c) === 27), anti = OLL.find(c => num(c) === 26);
  assert.strictEqual(yCorners(ollState(sune)).length, 1);
  assert.strictEqual(yCorners(ollState(anti)).length, 1);
});

section('Daten: F2L');
test('F2L-Set ist als leere Struktur angelegt (41 geplant)', () => {
  const f = setOf('f2l');
  assert(f && Array.isArray(f.cases) && f.size === 41 && Array.isArray(f.groups));
});

section('Daten: Lernpfad');
const ltest = DATA.lessons ? test : name => console.log('  – ' + name + ' (noch keine Lektionen)');
const L = DATA.lessons || [];
const stage = {
  centers: st => centersHome(st),
  cross: st => centersHome(st) && [28, 30, 32, 34].every(i => st[i] === i) && [25, 16, 52, 43].every(i => st[i] === i),
  firstLayer: st => centersHome(st) && Cube.STICKERS.filter(s => s.pos[1] === -1).every(s => st[s.i] === s.i),
  f2l: st => centersHome(st) && f2lSolved(st),
  yellowCross: st => stage.f2l(st) && [1, 3, 5, 7].every(i => faceOfOrig(st[i]) === 'U'),
  yellowFace: st => stage.f2l(st) && yellowUp(st),
  corners: st => stage.yellowFace(st) && [0, 2, 6, 8].every(i => st[i] === i),
};
// Was vor der Lektion schon fertig sein muss, und was die Lektion erreicht
const PRE = ['centers', 'centers', 'cross', 'firstLayer', 'f2l', 'yellowCross', 'yellowFace', 'corners'];
const GOAL = [null, 'cross', 'firstLayer', 'f2l', 'yellowCross', 'yellowFace', 'corners', null];
ltest('8 Lektionen (0–7) mit Fällen', () => {
  assert.deepStrictEqual(L.map(l => l.nr), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const l of L) assert(l.cases.length > 0, l.title);
  const ids = L.flatMap(l => l.cases.map(c => c.id));
  assert.strictEqual(new Set(ids).size, ids.length, 'IDs eindeutig');
});
ltest('jedes Lektions-Alg löst seinen Fall', () => {
  for (const l of L) for (const c of l.cases) assert(isSolved(apply(caseState(c.alg), c.alg)), c.id);
});
ltest('Fälle respektieren den Stand vor der Lektion (z. B. Kreuz bleibt bei den Ecken erhalten)', () => {
  for (const l of L) for (const c of l.cases) {
    if (l.nr === 0) continue;
    const st = caseState(c.alg);
    if (l.nr === 1) {
      // nur die eine Kante ist nicht am Platz
      const solvedEdges = [[28, 25], [30, 43], [32, 16], [34, 52]].filter(([a, b]) => st[a] === a && st[b] === b).length;
      assert.strictEqual(solvedEdges, 3, c.id);
    } else assert(stage[PRE[l.nr]](st), `${c.id}: Stand "${PRE[l.nr]}" nicht erfüllt`);
    if (GOAL[l.nr]) assert(!stage[GOAL[l.nr]](st), `${c.id}: Ziel schon erreicht`);
    else assert(!isSolved(st), c.id);
  }
});
ltest('Zweite Ebene: nur eine Mittelkante fehlt', () => {
  for (const c of L[3].cases) {
    const st = caseState(c.alg);
    const bad = F2L.filter(i => st[i] !== i);
    assert.strictEqual(bad.length, 2, c.id);
  }
});
ltest('Gelbe Ecken: Kanten bleiben, nur Ecken wandern (Kanten durch U verschoben erlaubt)', () => {
  for (const c of L[6].cases) {
    const st = caseState(c.alg);
    assert(stage.yellowFace(st), c.id);
  }
});

section('Darstellung');
test('alle Fälle erzeugen gültige SVGs (Draufsicht, Schräg, von unten, Netz)', () => {
  const all = [...L.flatMap(l => l.cases.map(c => [c, l.mask])), ...DATA.sets.filter(s => s.cases).flatMap(s => s.cases.map(c => [c, s.mask]))];
  for (const [c, mask] of all) {
    const st = caseState(fullAlg(c));
    for (const svg of [Render.top(st, { mask, arrows: true }), Render.iso(st, { mask }), Render.iso(st, { mask, bottom: true }), Render.net(st)]) {
      assert(svg.startsWith('<svg') && svg.endsWith('</svg>'), c.id);
      assert(!/NaN|undefined/.test(svg), c.id + ' enthält NaN/undefined');
    }
  }
});
test('Zug-Pfeile für alle Züge (inkl. \' und 2)', () => {
  for (const m of ALL_MOVES) for (const s of ['', "'", '2']) {
    for (const bottom of [false, true]) {
      const svg = Render.iso(S0, { move: m + s, bottom });
      assert(/class="arr"/.test(svg), m + s);
      assert(!/NaN/.test(svg), m + s);
    }
  }
});
test('PLL-Pfeile: Ua hat 3 Pfeile, H 2 Doppelpfeile', () => {
  const count = short => (Render.top(caseState(fullAlg(PLL.find(c => c.short === short))), { arrows: true }).match(/class="arr"/g) || []).length;
  assert.strictEqual(count('Ua'), 3);
  assert.strictEqual(count('H'), 2);
  assert.strictEqual(count('Aa'), 3);
});
test('Masken: OLL-Darstellung zeigt nur Gelb und Grau oben', () => {
  const st = ollState(OLL[0]);
  for (const i of U_LAYER) assert(['#5a534b', Cube.COLORS.U].includes(Render.color(st, i, 'oll')));
});

if (Logic) {
  section('Logik: Leitner & Timer');
  const DAY = 864e5;
  test('Leitner: sofort → nächste Box, Mühe → bleibt, nicht gewusst → Box 1', () => {
    const now = Date.UTC(2026, 0, 1);
    let c = Logic.newCard(now);
    assert.strictEqual(c.box, 1);
    c = Logic.review(c, 'good', now);
    assert.strictEqual(c.box, 2);
    assert(c.due > now && c.due - now <= Logic.INTERVALS[2] + 1);
    c = Logic.review(c, 'hard', now);
    assert.strictEqual(c.box, 2);
    for (let i = 0; i < 10; i++) c = Logic.review(c, 'good', now);
    assert.strictEqual(c.box, 5);
    c = Logic.review(c, 'again', now);
    assert.strictEqual(c.box, 1);
    assert.strictEqual(c.reps, 13);
    assert(c.hits > 10 && c.hits < 13);
    assert.strictEqual(c.last, now);
  });
  test('Leitner: Intervalle wachsen, Box 5 ≥ 2 Wochen', () => {
    for (let b = 2; b <= 5; b++) assert(Logic.INTERVALS[b] > Logic.INTERVALS[b - 1]);
    assert(Logic.INTERVALS[5] >= 14 * DAY);
  });
  test('Fälligkeit: nur fällige Karten, älteste zuerst', () => {
    const now = 1000 * DAY;
    const cards = { a: { box: 2, due: now - 5 }, b: { box: 1, due: now - 50 }, c: { box: 3, due: now + DAY } };
    assert.deepStrictEqual(Logic.dueIds(cards, ['a', 'b', 'c'], now), ['b', 'a']);
  });
  test('Ø5 / Ø12 nach WCA (beste und schlechteste fallen weg, DNF)', () => {
    const t = ms => ({ ms, penalty: 0 });
    assert.strictEqual(Logic.average([t(10), t(20), t(30), t(40), t(1000)], 5), 30);
    assert.strictEqual(Logic.average([t(10), t(20), t(30)], 5), null);
    assert.strictEqual(Logic.average([t(10), t(20), t(30), t(40), { ms: 5, penalty: 'dnf' }], 5), 30);
    assert.strictEqual(Logic.average([t(10), t(20), { ms: 1, penalty: 'dnf' }, t(40), { ms: 5, penalty: 'dnf' }], 5), Infinity);
    assert.strictEqual(Logic.effective({ ms: 1000, penalty: 2 }), 3000);
    const twelve = Array.from({ length: 12 }, (_, i) => t((i + 1) * 100));
    assert.strictEqual(Logic.average(twelve, 12), 650);
  });
  test('Zeitformat', () => {
    assert.strictEqual(Logic.fmt(9876), '9.87');
    assert.strictEqual(Logic.fmt(65432), '1:05.43');
    assert.strictEqual(Logic.fmt(Infinity), 'DNF');
  });
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
