import type { TFunction } from 'i18next';

const GENERATED_NAME_LABELS = [
  'Scene',
  'Text',
  'Image',
  'Video',
  'Shape',
  'Bar Spectrum',
  'Radial Spectrum',
  'Wave Spectrum',
  'Waveform Ring',
  'Sound Wave',
  'Geometry',
  'Tunnel',
  'Cubes',
  'Mesh Grid',
  'Color',
  'Blur',
  'Bloom',
  'Depth of Field',
  'Tilt Shift',
  'Distortion',
  'Glitch',
  'Kaleidoscope',
  'Mirror',
  'RGB Shift',
  'ASCII',
  'Color Halftone',
  'Dot Screen',
  'LED',
  'Pixelate',
  'Scanline',
  'Noise',
  'Perlin Noise',
  'Vignette',
] as const;

const GENERATED_NAME_PREFIXES = new Set<string>(GENERATED_NAME_LABELS);

function labelKey(label: string) {
  const words = label
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return words.join('-');
}

export function translateLabel(t: TFunction, label: unknown): string {
  if (typeof label !== 'string' || label.length === 0) {
    return label == null ? '' : String(label);
  }

  return String(t(`labels.${labelKey(label)}`, { defaultValue: label }));
}

export function translateGeneratedName(t: TFunction, name: string) {
  const match = /^(.+?) ([1-9]\d*)$/.exec(name);

  if (!match || !GENERATED_NAME_PREFIXES.has(match[1])) {
    return name;
  }

  return `${translateLabel(t, match[1])} ${match[2]}`;
}

export function translateSelectItems(t: TFunction, items: unknown) {
  if (!Array.isArray(items)) {
    return items;
  }

  return items.map(item => {
    if (item === null || item === undefined) {
      return item;
    }

    if (typeof item === 'string') {
      return {
        label: translateLabel(t, item),
        value: item,
      };
    }

    if (typeof item === 'object') {
      const itemProps = item as Record<string, unknown>;

      if (typeof itemProps.label !== 'string') {
        return item;
      }

      return {
        ...itemProps,
        label: translateLabel(t, itemProps.label),
      };
    }

    return item;
  });
}

export function translateControlProps(t: TFunction, props: Record<string, unknown>) {
  const translatedProps = { ...props };

  translatedProps.label = translateLabel(t, translatedProps.label);
  translatedProps.group = translateLabel(t, translatedProps.group);
  translatedProps.items = translateSelectItems(t, translatedProps.items);

  if (
    translatedProps.inputProps &&
    typeof translatedProps.inputProps === 'object' &&
    !Array.isArray(translatedProps.inputProps)
  ) {
    const inputProps = translatedProps.inputProps as Record<string, unknown>;

    translatedProps.inputProps = {
      ...inputProps,
      label: translateLabel(t, inputProps.label),
    };
  }

  return translatedProps;
}
