(() => {
  'use strict';

  const script = document.currentScript;
  const requestedPage = script?.dataset.page || 'index.html';
  const sourceParts = Array.from({ length: 7 }, (_, index) =>
    `payload/part-${String(index).padStart(2, '0')}`
  );
  const officialLogo = 'https://lat.ai/images/brand/latitude-title-logo.png';
  const officialPhoto = 'https://lat.ai/_next/static/media/work-at-latitude.22fcedb0.jpg';

  const decodeTar = (bytes) => {
    const files = new Map();
    const decoder = new TextDecoder('utf-8');
    let offset = 0;

    while (offset + 512 <= bytes.length) {
      const header = bytes.slice(offset, offset + 512);
      const name = decoder.decode(header.slice(0, 100)).replace(/\0.*$/, '');
      if (!name) break;

      const sizeField = decoder.decode(header.slice(124, 136)).replace(/\0.*$/, '').trim();
      const size = Number.parseInt(sizeField || '0', 8);
      const dataStart = offset + 512;
      const dataEnd = dataStart + size;
      files.set(name, bytes.slice(dataStart, dataEnd));
      offset = dataStart + Math.ceil(size / 512) * 512;
    }
    return files;
  };

  const renderFailure = (error) => {
    console.error(error);
    document.body.innerHTML = `
      <main style="max-width:760px;margin:10vh auto;padding:32px;font:16px/1.6 Arial,sans-serif;color:#08111f">
        <p style="color:#0062ff;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Latitude AI candidate campaign</p>
        <h1 style="font-size:clamp(2rem,6vw,4rem);line-height:1.02">The campaign source could not be assembled in this browser.</h1>
        <p>The printable artifacts remain directly available:</p>
        <p><a href="docs/Russell-Dudek-Latitude-AI-Resume.pdf">Resume</a> · <a href="docs/Russell-Dudek-Latitude-AI-Cover-Letter.pdf">Cover letter</a> · <a href="docs/Russell-Dudek-Latitude-AI-Interview-Brief.pdf">Interview brief</a> · <a href="docs/Russell-Dudek-Latitude-AI-90-Day-Plan.pdf">90-day plan</a> · <a href="docs/Russell-Dudek-Latitude-AI-Integration-Closure-Record.pdf">Closure record</a></p>
      </main>`;
  };

  const boot = async () => {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser does not support DecompressionStream.');
    }

    const responses = await Promise.all(sourceParts.map(async (path) => {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
      return response.text();
    }));

    const encoded = responses.join('').replace(/\s+/g, '');
    const compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const decompressedStream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const tarBytes = new Uint8Array(await new Response(decompressedStream).arrayBuffer());
    const files = decodeTar(tarBytes);
    const decoder = new TextDecoder('utf-8');

    const required = [requestedPage, 'styles.css', 'brand-tokens.css', 'app.js'];
    const missing = required.filter((name) => !files.has(name));
    if (missing.length) throw new Error(`Missing campaign source: ${missing.join(', ')}`);

    const tokens = decoder.decode(files.get('brand-tokens.css'));
    const styles = decoder.decode(files.get('styles.css'))
      .replace(/@import\s+url\([^;]+;/, '')
      .replaceAll('assets/brand/work-at-latitude.jpg', officialPhoto)
      .replaceAll('assets/brand/latitude-title-logo.png', officialLogo);
    const app = decoder.decode(files.get('app.js')).replaceAll('</script', '<\\/script');
    const html = decoder.decode(files.get(requestedPage))
      .replaceAll('assets/brand/latitude-title-logo.png', officialLogo)
      .replace(/<link\s+rel="stylesheet"\s+href="styles\.css">/i, `<style>${tokens}\n${styles}</style>`)
      .replace(/<script\s+src="app\.js"><\/script>/i, `<script>${app}<\/script>`);

    document.open();
    document.write(html);
    document.close();
  };

  boot().catch(renderFailure);
})();
