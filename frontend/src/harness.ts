import { buildStripCanvas } from '@/lib/sprite-strip';
// Tira 1200x256, fundo verde opaco, 4 "personagens" (corpo + braço) em posições e larguras desiguais, não quadrados.
async function make(bg: string | null) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 256; const g = c.getContext('2d')!;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 1200, 256); }
  const specs = [[60, 40, 0], [330, 60, 70], [700, 40, 30], [1010, 55, 60]]; // x do corpo, largura do corpo, braço
  specs.forEach(([x, w, arm], i) => {
    g.fillStyle = `hsl(${i * 80},70%,50%)`; g.fillRect(x, 70, w, 170); // corpo
    g.fillRect(x + w, 100, arm, 14); // braço esticado
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + w / 2, 50, 20, 0, 7); g.fill();
  });
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
  return new File([blob], 'tira.png', { type: 'image/png' });
}
(async () => {
  const out = document.getElementById('o')!;
  for (const [label, bg, green] of [['transparente', null, false], ['verde opaco', '#00ff00', true]] as const) {
    const f = await make(bg);
    for (const split of ['equal', 'ink'] as const) {
      const r = await buildStripCanvas([{ file: f, cells: 4, split }], { removeGreen: green });
      const p = document.createElement('p'); p.textContent = `${label} / ${split} — ${r.frames} quadros ${r.canvas.width}x${r.canvas.height} ${r.warnings.join(' | ')}`; p.style.cssText = 'color:#fff;font:12px sans-serif;margin:4px';
      out.append(p); r.canvas.style.cssText = 'background:#444;display:block;margin:2px 4px'; out.append(r.canvas);
    }
  }
  (window as any).done = true;
})();
