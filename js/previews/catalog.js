// What each exhibition shows on the field before anyone opens it.
// image: a still plate. clip: a short loop. solid: a small sculpture.
// The full interaction is not running out on the ground.
(function (root) {
  'use strict';

  const KINDS = ['image', 'clip', 'solid'];
  const LOW = 40;
  const HIGH = 256;

  function describe(mount) {
    const kind = KINDS[(mount.id - 1) % KINDS.length];
    const plate = kind !== 'solid';
    return {
      id: mount.id,
      kind,
      x: mount.x,
      z: mount.z,
      y: mount.y,
      tiers: {
        low: {size: plate ? LOW : 0, bytes: plate ? LOW * LOW * 4 : 4096},
        high: {size: plate ? HIGH : 0, bytes: plate ? HIGH * HIGH * 4 : 16384}
      }
    };
  }

  function hue(id) {
    return (id * 47) % 360;
  }

  function paint(work, size, time) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas, work, time || 0);
    return canvas;
  }

  function draw(canvas, work, time) {
    const size = canvas.width;
    const g = canvas.getContext('2d');
    const h = hue(work.id);
    g.clearRect(0, 0, size, size);
    g.fillStyle = '#f4efe6';
    g.fillRect(0, 0, size, size);
    if (work.kind === 'clip') {
      const shift = (time * 0.001) % 1;
      g.fillStyle = `hsl(${h} 32% 46%)`;
      for (let i = 0; i < 5; i++) {
        const t = (shift + i / 5) % 1;
        g.globalAlpha = 0.35 + 0.5 * (1 - Math.abs(t - 0.5) * 2);
        g.fillRect(size * (0.12 + t * 0.62), size * (0.22 + i * 0.1), size * 0.16, size * 0.07);
      }
      g.globalAlpha = 1;
    } else {
      g.fillStyle = `hsl(${h} 30% ${size < 80 ? 58 : 40}%)`;
      g.beginPath();
      g.arc(size * 0.5, size * 0.44, size * (0.22 + (work.id % 3) * 0.03), 0, Math.PI * 2);
      g.fill();
    }
    if (size >= 80) {
      g.fillStyle = '#243036';
      g.font = `600 ${Math.round(size * 0.14)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(work.id), size * 0.5, size * 0.8);
    }
  }

  root.StudioPreview = root.StudioPreview || {};
  root.StudioPreview.describe = describe;
  root.StudioPreview.paint = paint;
  root.StudioPreview.draw = draw;
})(window);
