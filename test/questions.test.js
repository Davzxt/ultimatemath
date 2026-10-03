import { generateQuestion } from '../public/js/questions.js';
let fails = 0; const kinds = {}; const texts = new Set();
const sets = [['add'], ['sub'], ['mul'], ['div'], ['add', 'sub'], ['add', 'sub', 'mul', 'div']];
for (let i = 0; i < 30000; i++) {
  const q = generateQuestion({ difficulty: ['mix', 1, 2, 3][i % 4], ops: sets[i % sets.length] });
  kinds[q.kind] = (kinds[q.kind] || 0) + 1; texts.add(q.q);
  const bad = q.choices.length !== 4 || new Set(q.choices).size !== 4 || !(q.correct >= 0) ||
    q.choices.some((c) => /NaN|undefined|Infinity|^-/.test(c)) || /NaN|undefined/.test(q.q + q.expl);
  if (bad && fails++ < 5) console.log('FAIL', q);
}
console.log('tipos:', kinds, '\nquestões distintas:', texts.size, '/ 30000');
if (fails) { console.log('falhas:', fails); process.exit(1); } else console.log('OK');
