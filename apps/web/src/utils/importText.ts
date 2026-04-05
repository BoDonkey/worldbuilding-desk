const decodeRtfHex = (hex: string): string => {
  const value = Number.parseInt(hex, 16);
  return Number.isNaN(value) ? '' : String.fromCharCode(value);
};

export const parseRtfToText = (raw: string): string => {
  const bodyStart = raw.search(/\\pard\b/);
  const bodyRaw = bodyStart >= 0 ? raw.slice(bodyStart) : raw;

  const withoutDestinations = bodyRaw
    .replace(/\{\\\*\\[^{}]+(?:\{[^{}]*\}|\}|[^{}])*\}/g, ' ')
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info)[^{}]*\}/g, ' ');

  const withUnicode = withoutDestinations.replace(/\\u(-?\d+)\??/g, (_match, value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return '';
    return String.fromCharCode(parsed < 0 ? parsed + 65536 : parsed);
  });

  const withHexDecoded = withUnicode.replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex: string) =>
    decodeRtfHex(hex)
  );

  const normalized = withHexDecoded
    .replace(/\\par[d]?(?![a-zA-Z])/g, '\n')
    .replace(/\\line(?![a-zA-Z])/g, '\n')
    .replace(/\\tab(?![a-zA-Z])/g, '\t')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/\\[^\\{}\s]+ ?/g, '')
    .replace(/\\([{}\\])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .replace(/\\/g, '')
    .replace(/[\u0080-\u009f]/g, '')
    .replace(/\b(?:deftab|viewkind|viewscale|f|fs|cf|sa|sl|slmult|li|ri|fi|qc|qj|ql|qr|tx|uc|kerning|expnd|expndtw|cocoartf|cocoasubrtf|paperw|paperh|margl|margr|margt|margb|widowctrl|hyphauto|hyphfactor|ltrpar|rtlpar|itap)\d+\b/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized) {
    return normalized;
  }

  const fallback = bodyRaw
    .replace(/\\par[d]?(?![a-zA-Z])/g, '\n')
    .replace(/\\line(?![a-zA-Z])/g, '\n')
    .replace(/\\tab(?![a-zA-Z])/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex: string) => decodeRtfHex(hex))
    .replace(/\\u(-?\d+)\??/g, (_match, value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) return '';
      return String.fromCharCode(parsed < 0 ? parsed + 65536 : parsed);
    })
    .replace(/\{\\\*\\[^{}]+(?:\{[^{}]*\}|\}|[^{}])*\}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/\\[^\\{}\s]+ ?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\r/g, '')
    .replace(/\\/g, ' ')
    .replace(/[\u0080-\u009f]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!fallback) {
    throw new Error('Could not extract readable text from this RTF file.');
  }

  return fallback;
};
