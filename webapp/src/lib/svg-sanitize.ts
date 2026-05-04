const BLOCKED_SELECTORS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
  'image',
  'use',
  'animate',
  'set',
];

const URL_ATTRS = ['href', 'xlink:href', 'src'];
const UNSAFE_URL = /^(?:javascript|data|vbscript):/i;

export function sanitizeSvgMarkup(markup: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;

  if (svg.nodeName.toLowerCase() !== 'svg') {
    return '';
  }

  for (const selector of BLOCKED_SELECTORS) {
    doc.querySelectorAll(selector).forEach((node) => node.remove());
  }

  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith('on') || name === 'style') {
        node.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRS.includes(name) && UNSAFE_URL.test(value)) {
        node.removeAttribute(attr.name);
      }
    }
  });

  return new XMLSerializer().serializeToString(svg);
}
