// Loads the simulation into Node: the js/sim/* files in the order index.html loads them.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
module.exports = function loadSim() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="(js\/sim\/[^"]+)"><\/script>/g)].map(m => m[1]);
  if (!files.length) throw new Error('no js/sim scripts found in index.html');
  const code = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  return new Function(code + ';return Sim;')();
};
