// Testes rápidos de evolution.js e rank.monthly (sem navegador).
import assert from "node:assert/strict";
globalThis.window = globalThis.window || {};
const EV = await import("../src/evolution.js");
const RK = await import("../src/rank.js");

// closeness: fechar, abrir e ficar no nível
let c = EV.closeness(2, 1); assert.equal(c.kind, "perto"); assert.equal(c.v, 0.5);
c = EV.closeness(1, 0 - 0.3); assert.equal(c.kind, "chegou"); assert.equal(c.gN, 0);
c = EV.closeness(-0.5, -0.1); assert.equal(c.kind, "nivel");
c = EV.closeness(0, 0.4); assert.equal(c.kind, "saiu"); assert.equal(c.v, -1);
c = EV.closeness(1, 2.5); assert.equal(c.kind, "longe"); assert.ok(c.v < 0);
console.log("  ok  closeness");

// monthly: um ponto por mês, o mais recente do mês
const h = [
  { t: Date.parse("2026-01-28T12:00:00Z"), v: 2400 },
  { t: Date.parse("2026-11-01T10:00:00Z"), v: 2140 },
  { t: Date.parse("2026-11-02T10:00:00Z"), v: 2170 },
  { t: Date.parse("2026-11-03T03:00:00Z"), v: 2182 },
];
const m = RK.monthly(h);
assert.equal(m.length, 2);
assert.equal(m[1].v, 2182);
console.log("  ok  rank.monthly");
console.log("\nTestes de evolução passaram.");
