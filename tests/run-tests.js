/* node tests/run-tests.js — запускает все тесты и пишет docs/TEST_RESULTS.md */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
for (const f of ['data', 'nlp', 'ai', 'engine', 'storage', 'shop']) require(path.join(ROOT, 'js', f + '.js'));
const { runAll } = require('./suite.js');
const t0 = Date.now();
const res = runAll(globalThis.RF, { simulate: true, games: +(process.env.GAMES || 4), levels: [1, 2] });
const ms = Date.now() - t0;
const L = ['# Результаты автотестов AGES OF DOMINION', '', `Запуск: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${(ms / 1000).toFixed(1)} с · **пройдено ${res.passed} из ${res.total}**`, '', 'Команда: `node tests/run-tests.js` (в браузере: `tests/tests.html`).'];
for (const s of res.sections) {
  L.push('', `## ${s.name}`, '', '| ID | Проверка | Итог | Фактически |', '|---|---|---|---|');
  for (const r of s.results) L.push(`| ${r.id} | ${r.name} | ${r.pass ? 'Pass' : '**Fail**'} | ${String(r.detail).replace(/\|/g, '/')} |`);
}
const n = res.nlp;
L.push('', '## NLP: отложенная выборка', '', `Фраз: **${n.size}** (не входят в обучающий корпус). Точность намерений **${(n.accuracy * 100).toFixed(1)}%**, сущностей **${n.entOk}/${n.entN}**.`, '', '| Намерение | Тестов | Верно |', '|---|---|---|');
for (const [k, v] of Object.entries(n.perIntent)) L.push(`| ${k} | ${v.n} | ${v.ok} |`);
const errs = n.rows.filter((r) => !r.ok);
L.push('', `### Ошибки (${errs.length})`, '');
if (!errs.length) L.push('Ошибок нет.');
else { L.push('| Фраза | Ожидалось | Получено | Уверенность | Сущности (ожид. / получ.) |', '|---|---|---|---|---|'); for (const r of errs) L.push(`| ${r.text} | ${r.expected} | ${r.got} | ${(r.conf * 100).toFixed(0)}% | ${r.ent || '—'} / ${r.gotEnt} |`); }
if (res.sim.length) {
  L.push('', '## Симуляция: игрок под управлением бота с чертами характера', '', '| Сценарий | Стиль бота | Партий | Побед | Войн против игрока / партия | Коалиций всего | Захватов городов / партия | Смен правителей / партия | Ходов |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of res.sim) L.push(`| ${r.level} | ${r.style} | ${r.games} | ${Math.round(r.winRate * 100)}% | ${r.warsOnPlayer.toFixed(2)} | ${r.coalitions} | ${r.captures.toFixed(1)} | ${r.successions.toFixed(1)} | ${r.avgTurns.toFixed(0)} |`);
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'TEST_RESULTS.md'), L.join('\n') + '\n', 'utf8');
for (const s of res.sections) { console.log(`\n== ${s.name}`); for (const r of s.results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} ${r.name} — ${r.detail}`); }
console.log(`\nNLP ${(n.accuracy * 100).toFixed(1)}%; ошибки: ${errs.map((e) => `${e.text} → ${e.got} ${e.gotEnt}`).join('; ') || 'нет'}`);
console.log(`Итого: ${res.passed}/${res.total} за ${(ms / 1000).toFixed(1)} с`);
process.exit(res.passed === res.total ? 0 : 1);
