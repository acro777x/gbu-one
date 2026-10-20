/**
 * GBU One — colour contrast helpers.
 *
 * The palette is checked against WCAG AA in the test suite, so a future tweak
 * cannot silently break readability. This module is the single implementation
 * both the test and `tools/contrast_check.py` rely on.
 */

/** Parses `#RRGGBB`, `#RRGGBBAA` or `rgba(r, g, b, a)` into its channels. */
export function parseColour(colour: string): { r: number; g: number; b: number; a: number } | null {
  const value = colour.trim();

  const hex = value.replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }

  const rgba = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      const channel = (raw: string): number =>
        raw.endsWith('%')
          ? (parseFloat(raw) / 100) * 255
          : parseFloat(raw);
      return {
        r: channel(parts[0]),
        g: channel(parts[1]),
        b: channel(parts[2]),
        a: parts.length > 3 ? parseFloat(parts[3]) : 1,
      };
    }
  }

  return null;
}

/** Flattens a translucent colour onto an opaque background. */
export function flatten(colour: string, background: string): string | null {
  const top = parseColour(colour);
  const bottom = parseColour(background);
  if (!top || !bottom) return null;
  if (top.a >= 1) return colour;

  const mix = (a: number, b: number): number => Math.round(a * top.a + b * (1 - top.a));
  const r = mix(top.r, bottom.r);
  const g = mix(top.g, bottom.g);
  const b = mix(top.b, bottom.b);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(colour: string): number | null {
  const parsed = parseColour(colour);
  if (!parsed) return null;
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(parsed.r) + 0.7152 * channel(parsed.g) + 0.0722 * channel(parsed.b)
  );
}

/**
 * The WCAG contrast ratio between two colours, from 1 to 21.
 * A translucent foreground is flattened onto the background first.
 */
export function contrastRatio(foreground: string, background: string): number {
  const solidForeground = flatten(foreground, background) ?? foreground;
  const a = relativeLuminance(solidForeground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return Number.NaN;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when the pair meets WCAG AA for body text. */
export function meetsAa(foreground: string, background: string): boolean {
  const ratio = contrastRatio(foreground, background);
  return Number.isFinite(ratio) && ratio >= 4.5;
}
