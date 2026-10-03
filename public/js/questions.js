// Gerador de questões das 4 operações para o 6º ano (compartilhado entre servidor e cliente).
// Cada questão: { q, choices[4], correct, op, kind, expl }

const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const r2 = (n) => Math.round(n * 100) / 100;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = R(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const fmt = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const money = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const OPS = { add: '+', sub: '−', mul: '×', div: '÷' };
const NAMES = ['Ana', 'Bruno', 'Carla', 'Davi', 'Enzo', 'Lara', 'Miguel', 'Sofia', 'Théo', 'Valentina', 'Gabriel', 'Helena', 'Pedro', 'Alice', 'Arthur', 'Laura', 'Heitor', 'Manuela', 'Rafael', 'Júlia', 'Lucas', 'Isabela'];

// ---------- distratores (erros típicos) ----------
const revDigits = (n) => Number(String(n).split('').reverse().join(''));
const noCarryAdd = (a, b) => { // soma "esquecendo o vai-um"
  const s = String(a).padStart(8, '0'), t = String(b).padStart(8, '0');
  return Number([...s].map((d, i) => (+d + +t[i]) % 10).join(''));
};
const absDigitSub = (a, b) => { // subtrai "o menor do maior" em cada coluna
  const s = String(a).padStart(8, '0'), t = String(b).padStart(8, '0');
  return Number([...s].map((d, i) => Math.abs(+d - +t[i])).join(''));
};

function numChoices(ans, extra = []) {
  ans = r2(ans);
  const dec = !Number.isInteger(ans);
  const generic = shuffle(dec
    ? [ans + 0.1, ans - 0.1, ans * 10, ans / 10, ans + 1, ans - 1, ans + 0.5, ans - 0.01]
    : [ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, ans - 2, revDigits(ans), ans + 100, ans - 100, ans * 10]);
  const set = new Set();
  for (const v0 of [...shuffle(extra), ...generic]) {
    const v = r2(v0);
    if (v !== ans && v >= 0 && Number.isFinite(v) && !set.has(v) && set.size < 3) set.add(v);
  }
  while (set.size < 3) { const v = r2(ans + R(-25, 25) * (dec ? 0.1 : 1)); if (v !== ans && v >= 0) set.add(v); }
  return finish(fmt(ans), [...set].map(fmt));
}
function finish(ans, wrongs) {
  const choices = shuffle([ans, ...wrongs.slice(0, 3)]);
  return { choices, correct: choices.indexOf(ans) };
}

// ---------- explicações passo a passo ----------
const parts = (n) => { // 347 -> [300, 40, 7]
  const s = String(n); return [...s].map((d, i) => +d * 10 ** (s.length - 1 - i)).filter((x) => x > 0);
};
function chainExpl(a, b, sign) {
  let cur = a; const steps = [];
  for (const p of parts(b)) { const nx = sign === '+' ? cur + p : cur - p; steps.push(`${fmt(cur)} ${sign === '+' ? '+' : '−'} ${fmt(p)} = ${fmt(nx)}`); cur = nx; }
  return `Decomponha ${fmt(b)} em ${parts(b).map(fmt).join(' + ')} e vá por partes: ` + steps.join(' → ');
}
function mulExpl(a, b) {
  const big = Math.max(a, b), small = Math.min(a, b);
  const ps = parts(small).length > 1 && small > 9 ? parts(small) : null;
  if (ps) return `${fmt(big)} × ${fmt(small)} = ` + ps.map((p) => `${fmt(big)}×${fmt(p)}`).join(' + ') + ' = ' + ps.map((p) => fmt(big * p)).join(' + ') + ` = ${fmt(a * b)}`;
  const pb = parts(big);
  if (pb.length > 1) return `${fmt(big)} × ${small} = ` + pb.map((p) => `${fmt(p)}×${small}`).join(' + ') + ' = ' + pb.map((p) => fmt(p * small)).join(' + ') + ` = ${fmt(a * b)}`;
  return `Tabuada: ${a} × ${b} = ${fmt(a * b)}. Dica: ${a} × ${b} é o mesmo que somar ${a} vezes o ${b}.`;
}
const divExpl = (a, b, q) => `Pense: qual número vezes ${fmt(b)} dá ${fmt(a)}? Como ${fmt(q)} × ${fmt(b)} = ${fmt(a)}, a resposta é ${fmt(q)}.`;

// ---------- geradores por tipo ----------
const RANGES = { 1: [10, 99], 2: [100, 999], 3: [1000, 99999] };

const K = {};

K.add = (d) => {
  const [lo, hi] = RANGES[d]; const a = R(lo, hi), b = R(lo, hi);
  return { q: `${fmt(a)} + ${fmt(b)} = ?`, ...numChoices(a + b, [noCarryAdd(a, b), a + b - 10, a + b + 10]), expl: chainExpl(a, b, '+') };
};
K.sub = (d) => {
  const [lo, hi] = RANGES[d]; let a = R(lo, hi), b = R(lo, hi); if (a < b) [a, b] = [b, a]; if (a === b) a += R(1, 9);
  return { q: `${fmt(a)} − ${fmt(b)} = ?`, ...numChoices(a - b, [absDigitSub(a, b), a + b, a - b + 10]), expl: chainExpl(a, b, '-') + `. Confira: ${fmt(a - b)} + ${fmt(b)} = ${fmt(a)} ✔` };
};
K.mul = (d) => {
  const a = d === 1 ? R(2, 10) : d === 2 ? R(12, 99) : R(101, 999);
  const b = d === 1 ? R(2, 10) : d === 2 ? R(3, 9) : R(11, 49);
  return { q: `${fmt(a)} × ${fmt(b)} = ?`, ...numChoices(a * b, [a * b + a, a * b - a, a * b + b, a + b]), expl: mulExpl(a, b) };
};
K.div = (d) => {
  const b = d === 1 ? R(2, 10) : d === 2 ? R(3, 12) : R(11, 35);
  const q = d === 1 ? R(2, 10) : d === 2 ? R(11, 99) : R(21, 999);
  const a = b * q;
  return { q: `${fmt(a)} ÷ ${fmt(b)} = ?`, ...numChoices(q, [q + 1, q - 1, q * 10, Math.floor(q / 10)]), expl: divExpl(a, b, q) };
};

K.missing = (d, op) => {
  const n = d === 1 ? 50 : d === 2 ? 500 : 5000;
  let q, ans, expl;
  if (op === 'add') { const a = R(5, n), x = R(5, n); q = pick([`${fmt(a)} + ? = ${fmt(a + x)}`, `? + ${fmt(a)} = ${fmt(a + x)}`]); ans = x; expl = `Use a operação inversa: ${fmt(a + x)} − ${fmt(a)} = ${fmt(x)}.`; }
  if (op === 'sub') { const x = R(5, n), b = R(5, n); if (Math.random() < 0.5) { q = `? − ${fmt(b)} = ${fmt(x)}`; ans = x + b; expl = `Inverso da subtração é a adição: ${fmt(x)} + ${fmt(b)} = ${fmt(x + b)}.`; } else { q = `${fmt(x + b)} − ? = ${fmt(x)}`; ans = b; expl = `${fmt(x + b)} − ${fmt(x)} = ${fmt(b)}.`; } }
  if (op === 'mul') { const a = R(2, d === 3 ? 25 : 12), x = R(2, d === 1 ? 10 : d === 2 ? 20 : 60); q = `${fmt(a)} × ? = ${fmt(a * x)}`; ans = x; expl = `Inverso da multiplicação é a divisão: ${fmt(a * x)} ÷ ${fmt(a)} = ${fmt(x)}.`; }
  if (op === 'div') { const b = R(2, d === 3 ? 25 : 12), x = R(2, d === 1 ? 10 : 40); if (Math.random() < 0.5) { q = `? ÷ ${fmt(b)} = ${fmt(x)}`; ans = b * x; expl = `Inverso da divisão é a multiplicação: ${fmt(x)} × ${fmt(b)} = ${fmt(b * x)}.`; } else { q = `${fmt(b * x)} ÷ ? = ${fmt(x)}`; ans = b; expl = `${fmt(b * x)} ÷ ${fmt(x)} = ${fmt(b)}.`; } }
  return { q: 'Descubra o número que falta: ' + q, ...numChoices(ans), expl };
};

K.decimal = (d, op) => {
  const dp = d === 1 ? 1 : 2;
  const dec = (lo, hi) => r2(R(lo * 10 ** dp, hi * 10 ** dp) / 10 ** dp);
  let a, b, ans, expl, s;
  if (op === 'add') { a = dec(1, d * 20); b = dec(1, d * 20); ans = r2(a + b); s = '+'; expl = `Vírgula embaixo de vírgula! Complete com zeros e some como números inteiros: ${fmt(a)} + ${fmt(b)} = ${fmt(ans)}.`; }
  if (op === 'sub') { a = dec(5, d * 30); b = dec(1, a - 0.5); if (b >= a) b = r2(a / 2); ans = r2(a - b); s = '−'; expl = `Alinhe as vírgulas e complete com zeros: ${fmt(a)} − ${fmt(b)} = ${fmt(ans)}. Confira: ${fmt(ans)} + ${fmt(b)} = ${fmt(a)}.`; }
  if (op === 'mul') { const t = R(11, d === 1 ? 50 : 250); a = t / 10; b = R(2, 9); ans = r2(a * b); s = '×'; expl = `Ignore a vírgula: ${t} × ${b} = ${t * b}. Como ${fmt(a)} tem 1 casa decimal, a resposta também tem: ${fmt(ans)}.`; }
  if (op === 'div') { b = R(2, 9); const t = b * R(11, d === 1 ? 30 : 120); a = t / 10; ans = r2(a / b); s = '÷'; expl = `Pense em ${t} ÷ ${b} = ${t / b} e depois volte 1 casa decimal: ${fmt(ans)}.`; }
  return { q: `${fmt(a)} ${s} ${fmt(b)} = ?`, ...numChoices(ans, [ans * 10, ans / 10, r2(ans + 1)]), expl };
};

K.pow10 = (d, op) => {
  const p = pick(d === 1 ? [10, 100] : [10, 100, 1000]); const z = String(p).length - 1;
  if (op === 'mul') { const a = d === 3 ? r2(R(11, 999) / 10) : R(2, 999); const ans = r2(a * p); return { q: `${fmt(a)} × ${fmt(p)} = ?`, ...numChoices(ans, [ans * 10, ans / 10, a * (p / 10)]), expl: `Multiplicar por ${fmt(p)} desloca a vírgula ${z} casa(s) para a DIREITA (ou acrescenta ${z} zero(s)): ${fmt(ans)}.` }; }
  const a = R(2, 999) * (d === 1 ? p : 1); const ans = r2(a / p);
  return { q: `${fmt(a)} ÷ ${fmt(p)} = ?`, ...numChoices(ans, [ans * 10, ans / 10, a]), expl: `Dividir por ${fmt(p)} desloca a vírgula ${z} casa(s) para a ESQUERDA: ${fmt(ans)}.` };
};

K.remainder = (d) => {
  const b = R(3, d === 3 ? 25 : 9), q = R(3, d === 1 ? 12 : 120), r = R(1, b - 1), a = b * q + r;
  if (Math.random() < 0.5) return { q: `Qual é o RESTO de ${fmt(a)} ÷ ${b}?`, ...numChoices(r, [b - r, q, r + 1]), expl: `${fmt(q)} × ${b} = ${fmt(b * q)}, e ${fmt(a)} − ${fmt(b * q)} = ${r}. Logo ${fmt(a)} = ${b} × ${fmt(q)} + ${r}. O resto é sempre menor que o divisor!` };
  return { q: `Qual é o QUOCIENTE de ${fmt(a)} ÷ ${b}? (divisão com resto)`, ...numChoices(q, [q + 1, r, q - 1]), expl: `${b} × ${fmt(q)} = ${fmt(b * q)} (cabe) e ${b} × ${fmt(q + 1)} = ${fmt(b * (q + 1))} (passa). Quociente ${fmt(q)}, resto ${r}.` };
};

K.half = (d, op) => {
  const n = R(5, d === 1 ? 50 : d === 2 ? 500 : 5000);
  if (op === 'mul') { const [w, k] = pick([['o dobro', 2], ['o triplo', 3], ['o quádruplo', 4], ['o quíntuplo', 5]]); return { q: `Quanto é ${w} de ${fmt(n)}?`, ...numChoices(n * k, [n + k, n * (k + 1), n * (k - 1)]), expl: `${w[2].toUpperCase() + w.slice(3)} é multiplicar por ${k}: ${fmt(n)} × ${k} = ${fmt(n * k)}.` }; }
  const [w, k] = pick([['a metade', 2], ['a terça parte', 3], ['a quarta parte', 4], ['a décima parte', 10]]); const m = n * k;
  return { q: `Quanto é ${w} de ${fmt(m)}?`, ...numChoices(n, [m - k, n * 2, n + 1]), expl: `${w[2].toUpperCase() + w.slice(3)} é dividir por ${k}: ${fmt(m)} ÷ ${k} = ${fmt(n)}.` };
};

K.whichCorrect = (d, op) => {
  const base = K[op](d); const m = base.q.match(/^(.+) = \?$/); const expr = m[1];
  const right = expr + ' = ' + base.choices[base.correct];
  const wrongs = base.choices.filter((_, i) => i !== base.correct).map((c) => expr + ' = ' + c);
  return { q: 'Qual conta está CERTA?', ...finish(right, wrongs), expl: base.expl, small: true };
};

K.whichOp = (d) => {
  const op = pick(['add', 'sub', 'mul', 'div']);
  let a, b, c;
  if (op === 'add') { a = R(10, 99); b = R(10, 99); c = a + b; }
  if (op === 'sub') { a = R(50, 200); b = R(2, 49); c = a - b; }
  if (op === 'mul') { a = R(3, 12); b = R(3, 12); c = a * b; if (c === a + b) b++, c = a * b; }
  if (op === 'div') { b = R(2, 9); c = R(3, 12); a = b * c; }
  const syms = ['+', '−', '×', '÷'];
  return { q: `Qual operação completa a conta?  ${a} ☐ ${b} = ${c}`, ...finish(OPS[op], syms.filter((s) => s !== OPS[op])), expl: `${a} ${OPS[op]} ${b} = ${c}. Teste cada sinal mentalmente!`, op };
};

K.expr = (d) => {
  const t = R(1, 5);
  let q, ans, expl;
  const a = R(2, d === 1 ? 20 : 60), b = R(2, 9), c = R(2, 9), e = R(2, 9);
  if (t === 1) { ans = a + b * c; q = `${a} + ${b} × ${c}`; expl = `Primeiro a multiplicação: ${b} × ${c} = ${b * c}. Depois: ${a} + ${b * c} = ${ans}.`; return { q: `Resolva: ${q} = ?`, ...numChoices(ans, [(a + b) * c]), expl }; }
  if (t === 2) { ans = (a + b) * c; q = `(${a} + ${b}) × ${c}`; expl = `Primeiro o parênteses: ${a} + ${b} = ${a + b}. Depois: ${a + b} × ${c} = ${ans}.`; return { q: `Resolva: ${q} = ?`, ...numChoices(ans, [a + b * c]), expl }; }
  if (t === 3) { const big = b * c * e + R(0, 30); ans = big - b * c; q = `${big} − ${b} × ${c}`; expl = `Multiplicação antes: ${b} × ${c} = ${b * c}. Depois: ${big} − ${b * c} = ${ans}.`; return { q: `Resolva: ${q} = ?`, ...numChoices(ans, [(big - b) * c]), expl }; }
  if (t === 4) { const dv = b * c; ans = a + dv / b; q = `${a} + ${dv} ÷ ${b}`; expl = `Divisão antes da adição: ${dv} ÷ ${b} = ${c}. Depois: ${a} + ${c} = ${ans}.`; return { q: `Resolva: ${q} = ?`, ...numChoices(ans, [Math.round((a + dv) / b)]), expl }; }
  ans = b * c + e * a; q = `${b} × ${c} + ${e} × ${a}`; expl = `Faça as duas multiplicações: ${b * c} e ${e * a}. Depois some: ${ans}.`;
  return { q: `Resolva: ${q} = ?`, ...numChoices(ans, [(b * c + e) * a]), expl };
};

K.time = (d) => {
  const [txt, k, unit] = pick([['horas', 60, 'minutos'], ['minutos', 60, 'segundos'], ['dias', 24, 'horas'], ['semanas', 7, 'dias'], ['anos', 12, 'meses'], ['metros', 100, 'centímetros'], ['quilômetros', 1000, 'metros'], ['quilos', 1000, 'gramas']]);
  const n = R(2, d === 1 ? 9 : 25);
  return { q: `Quantos ${unit} há em ${n} ${txt}?`, ...numChoices(n * k, [n * k + k, n + k, n * k - k]), expl: `Cada 1 tem ${k} ${unit}. Então ${n} × ${k} = ${fmt(n * k)}.` };
};

// ---------- problemas (situações do dia a dia) ----------
const WORD = {
  add: [
    (d) => { const n = pick(NAMES), a = R(20, d * 300), b = R(10, d * 200); return [`${n} tinha ${fmt(a)} figurinhas e ganhou mais ${fmt(b)}. Com quantas ficou?`, a + b, `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)} figurinhas.`]; },
    (d) => { const a = R(100, d * 3000), b = R(100, d * 3000); return [`Um jogo de futebol teve ${fmt(a)} torcedores no sábado e ${fmt(b)} no domingo. Quantos no total?`, a + b, `Juntar = somar: ${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}.`]; },
    (d) => { const a = R(10, 60), b = R(10, 60), c = R(10, 60); return [`Uma biblioteca recebeu ${a} livros de aventura, ${b} de ciência e ${c} de poesia. Quantos livros chegaram?`, a + b + c, `${a} + ${b} + ${c} = ${a + b + c}.`]; },
    (d) => { const p = r2(R(150, 900) / 100 * d), q = r2(R(150, 900) / 100); return [`Um lanche custa ${money(p)} e um suco ${money(q)}. Quanto custam juntos? (em reais)`, r2(p + q), `Vírgula embaixo de vírgula: ${money(p)} + ${money(q)} = ${money(p + q)}.`]; },
  ],
  sub: [
    (d) => { const a = R(200, d * 900), b = R(20, a - 10); return [`Uma escola tem ${fmt(a)} alunos. ${fmt(b)} foram ao passeio. Quantos ficaram na escola?`, a - b, `Tirar = subtrair: ${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}.`]; },
    (d) => { const n = pick(NAMES), m = pick(NAMES.filter((x) => x !== n)), b = R(100, d * 900), a = b + R(10, d * 400); return [`No videogame, ${n} fez ${fmt(a)} pontos e ${m} fez ${fmt(b)}. Quantos pontos ${n} fez a mais?`, a - b, `Comparar = subtrair: ${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}.`]; },
    (d) => { const n = pick(NAMES), pay = pick([20, 50, 100]), c = r2(R(150, pay * 100 - 50) / 100); return [`${n} pagou com uma nota de ${money(pay)} uma compra de ${money(c)}. Qual foi o troco? (em reais)`, r2(pay - c), `${money(pay)} − ${money(c)} = ${money(pay - c)}.`]; },
    (d) => { const y = R(1950, 2015); return [`Uma pessoa nasceu em ${y}. Quantos anos ela completa em 2026?`, 2026 - y, `2026 − ${y} = ${2026 - y}.`]; },
  ],
  mul: [
    (d) => { const a = R(6, d * 24), b = R(3, d * 12); return [`Cada caixa tem ${a} lápis. Quantos lápis há em ${b} caixas?`, a * b, `Grupos iguais = multiplicar: ${a} × ${b} = ${fmt(a * b)}.`]; },
    (d) => { const r = R(4, 12 + d * 5), c = R(4, 12 + d * 5); return [`Um auditório tem ${r} fileiras com ${c} cadeiras cada. Quantas cadeiras há?`, r * c, `${r} × ${c} = ${fmt(r * c)} cadeiras.`]; },
    (d) => { const p = d === 1 ? R(2, 15) : r2(R(150, 1500) / 100), k = R(2, 9); return [`Um caderno custa ${money(p)}. Quanto custam ${k} cadernos? (em reais)`, r2(p * k), `${money(p)} × ${k} = ${money(p * k)}.`]; },
    (d) => { const n = pick(NAMES), p = R(5, 15 + d * 10), c = R(3, 7 + d * 7); return [`${n} lê ${p} páginas por dia. Quantas páginas lerá em ${c} dias?`, p * c, `${p} × ${c} = ${fmt(p * c)} páginas.`]; },
  ],
  div: [
    (d) => { const n = pick(NAMES), b = R(2, 9 + d), q = R(3, d * 25); return [`${n} dividiu ${fmt(b * q)} balas igualmente entre ${b} amigos. Quantas cada um recebeu?`, q, `Repartir igualmente = dividir: ${fmt(b * q)} ÷ ${b} = ${q}.`]; },
    (d) => { const cap = pick([30, 40, 45, 50]), p = R(cap + 1, cap * (3 + d * 3)); const ans = Math.ceil(p / cap); return [`Cada ônibus leva ${cap} pessoas. Quantos ônibus são necessários para levar ${fmt(p)} pessoas?`, ans, `${fmt(p)} ÷ ${cap} = ${Math.floor(p / cap)} com resto ${p % cap}${p % cap ? '. Quem sobrou também precisa ir: mais 1 ônibus!' : ''} Total: ${ans}.`]; },
    (d) => { const o = R(30, d * 400); const ans = Math.floor(o / 12); return [`Uma granja colocou ${fmt(o)} ovos em caixas de 12. Quantas caixas ficaram COMPLETAS?`, ans, `${fmt(o)} ÷ 12 = ${ans} com resto ${o % 12}. Caixas completas: ${ans}.`]; },
    (d) => { const k = R(2, 8), each = d === 1 ? R(2, 20) : r2(R(150, 2500) / 100); return [`${k} amigos dividiram igualmente uma conta de ${money(each * k)}. Quanto cada um pagou? (em reais)`, each, `${money(each * k)} ÷ ${k} = ${money(each)}.`]; },
  ],
};
K.word = (d, op) => { const [q, ans, expl] = pick(WORD[op])(d); return { q, ...numChoices(ans), expl, small: true }; };

// tipos -> operações que cobrem + peso
const KINDS = [
  ['basic', null, 6], ['missing', null, 2], ['decimal', null, 2], ['word', null, 3], ['whichCorrect', null, 1],
  ['pow10', ['mul', 'div'], 1], ['remainder', ['div'], 1], ['half', ['mul', 'div'], 1], ['time', ['mul'], 1],
  ['expr', 'multi', 2], ['whichOp', 'all', 1],
];

export function generateQuestion({ difficulty = 'mix', ops = ['add', 'sub', 'mul', 'div'] } = {}) {
  ops = ops.filter((o) => OPS[o]); if (!ops.length) ops = Object.keys(OPS);
  const d = difficulty === 'mix' ? R(1, 3) : Math.max(1, Math.min(3, +difficulty || 2));
  const pool = [];
  for (const [k, cover, w] of KINDS) {
    if (cover === 'all' && ops.length < 4) continue;
    if (cover === 'multi' && ops.length < 2) continue;
    if (Array.isArray(cover) && !cover.some((o) => ops.includes(o))) continue;
    for (let i = 0; i < w; i++) pool.push(k);
  }
  const kind = pick(pool);
  let op = pick(Array.isArray(KINDS.find((x) => x[0] === kind)[1]) ? KINDS.find((x) => x[0] === kind)[1].filter((o) => ops.includes(o)) : ops);
  let res;
  if (kind === 'basic') res = K[op](d);
  else if (kind === 'expr') { res = K.expr(d); op = 'mix'; }
  else res = K[kind](d, op);
  return { op: res.op || op, kind, d, ...res };
}
