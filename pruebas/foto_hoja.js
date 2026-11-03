// Genera la «foto» de una hoja de respuestas resuelta (para la prueba de punta a punta): node foto_hoja.js n nOps idx hash "0,1,2,…" salida.gray
const L4 = require("../www/js/logica4.js");
const src = require("fs").readFileSync(__dirname + "/logica4.test.js", "utf8");
eval(src.slice(src.indexOf("function photo"), src.indexOf('test("hoja de burbujas')));
const [n, nOps, idx, hash, resp, out] = process.argv.slice(2);
const lay = L4.sheetLayout(+n, +nOps), marks = {};
resp.split(",").forEach((r, i) => { if (r !== "") marks[i + 1] = +r; });
const ph = photo(lay, L4.codeBits(+idx, +hash), marks, { tilt: 0.07, light: 0.3, noise: 20, seed: 5 });
require("fs").writeFileSync(out, Buffer.from(ph.g));
console.log(ph.w, ph.h);
