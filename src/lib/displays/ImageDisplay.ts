import useAudioStore from '@/app/actions/audio';
import { BLANK_IMAGE } from '@/app/constants';
import Display from '@/lib/core/Display';
import { isDefined } from '@/lib/utils/array';
import { fitMediaWithinBounds } from '@/lib/utils/media';

interface ImageDisplayInstance {
  hasImage: boolean;
  image: HTMLImageElement;
  scene: { getSize(): { width: number; height: number } };
  properties: Record<string, unknown>;
}

const disabled = (display: ImageDisplayInstance) => !display.hasImage;
const maxWidth = (display: ImageDisplayInstance) => {
  const { naturalWidth } = display.image;
  const { width } = display.scene.getSize();

  return naturalWidth > width ? naturalWidth : width;
};
const maxHeight = (display: ImageDisplayInstance) => {
  const { naturalHeight } = display.image;
  const { height } = display.scene.getSize();

  return naturalHeight > height ? naturalHeight : height;
};
const maxX = (display: ImageDisplayInstance) => (disabled(display) ? 0 : maxWidth(display));
const maxY = (display: ImageDisplayInstance) => (disabled(display) ? 0 : maxHeight(display));
const getFittedSize = (display: ImageDisplayInstance, mediaWidth: number, mediaHeight: number) => {
  const { width, height } = display.scene.getSize();
  return fitMediaWithinBounds(mediaWidth, mediaHeight, width, height);
};

export default class ImageDisplay extends Display {
  declare image: HTMLImageElement;
  declare scene: { getSize(): { width: number; height: number } };
  static config = {
    name: 'ImageDisplay',
    description: 'Displays an image.',
    type: 'display',
    label: 'Image',
    defaultProperties: {
      src: BLANK_IMAGE,
      sourcePath: '',
      useTrackArtwork: 'None',
      x: 0,
      y: 0,
      zoom: 1,
      audioPulse: 0.0, // Built-in simple beat zoom reactiveness
      waveAmp: 0, // Wave distortion amplitude (default off)
      waveFreq: 2.5,
      waveSpeed: 1.0,
      waveReact: 1.0,
      width: 0,
      height: 0,
      fixed: true,
      rotation: 0,
      opacity: 0,
      parallaxMode: 'None',
      parallaxSpeed: 1.0,
      parallaxAmount: 20,
      renderInBackground: false,
    },
    controls: {
      src: {
        label: 'Image',
        type: 'image',
        disabled: (display: ImageDisplayInstance) => {
          const val = display.properties.useTrackArtwork;
          return val !== false && val !== 'None';
        },
      },
      useTrackArtwork: {
        label: 'Use Track Artwork',
        type: 'select',
        items: (display: ImageDisplayInstance) => {
          const playlist = useAudioStore.getState().playlist;
          const items = [
            { label: 'None', value: 'None' },
            { label: 'Active Track', value: 'Active Track' },
          ];
          playlist.forEach((track, index) => {
            items.push({
              label: `Track ${index + 1}: ${track.name}`,
              value: track.id,
            });
          });
          return items;
        },
      },
      width: {
        label: 'Width',
        type: 'number',
        min: 0,
        max: maxWidth,
        withRange: true,
        withLink: 'fixed',
        disabled,
      },
      height: {
        label: 'Height',
        type: 'number',
        min: 0,
        max: maxHeight,
        withRange: true,
        withLink: 'fixed',
        disabled,
      },
      x: {
        label: 'X',
        type: 'number',
        min: (display: ImageDisplayInstance) => -1 * maxX(display),
        max: (display: ImageDisplayInstance) => maxX(display),
        withRange: true,
        hideFill: true,
        disabled,
      },
      y: {
        label: 'Y',
        type: 'number',
        min: (display: ImageDisplayInstance) => -1 * maxY(display),
        max: (display: ImageDisplayInstance) => maxY(display),
        withRange: true,
        hideFill: true,
        disabled,
      },
      zoom: {
        label: 'Zoom',
        type: 'number',
        min: 1.0,
        max: 4.0,
        step: 0.01,
        withRange: true,
        withReactor: true,
        disabled,
      },
      audioPulse: {
        label: 'Audio Zoom (Jedug-Jedug)',
        type: 'number',
        min: 0.0,
        max: 2.5,
        step: 0.05,
        withRange: true,
        disabled,
      },
      waveAmp: {
        label: 'Wave Amplitude',
        type: 'number',
        min: 0,
        max: 50,
        step: 0.1,
        withRange: true,
        disabled,
      },
      waveFreq: {
        label: 'Wave Frequency',
        type: 'number',
        min: 0.5,
        max: 10.0,
        step: 0.1,
        withRange: true,
        disabled,
      },
      waveSpeed: {
        label: 'Wave Speed',
        type: 'number',
        min: 0.1,
        max: 3.0,
        step: 0.1,
        withRange: true,
        disabled,
      },
      waveReact: {
        label: 'Wave Reactivity',
        type: 'number',
        min: 0.0,
        max: 3.0,
        step: 0.1,
        withRange: true,
        disabled,
      },
      rotation: {
        label: 'Rotation',
        type: 'number',
        min: 0,
        max: 360,
        withRange: true,
        withReactor: true,
        disabled,
      },
      opacity: {
        label: 'Opacity',
        type: 'number',
        min: 0,
        max: 1.0,
        step: 0.01,
        withRange: true,
        withReactor: true,
        disabled,
      },
      parallaxMode: {
        label: 'Parallax Mode',
        type: 'select',
        items: ['None', 'Slow Drift', 'Mouse Move', 'Audio Reaction'],
        disabled,
      },
      parallaxSpeed: {
        label: 'Parallax Speed',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
        withRange: true,
        disabled: (display: ImageDisplayInstance) =>
          disabled(display) || display.properties.parallaxMode === 'None',
      },
      parallaxAmount: {
        label: 'Parallax Amount',
        type: 'number',
        min: 1,
        max: 100,
        step: 1,
        disabled: (display: ImageDisplayInstance) =>
          disabled(display) || display.properties.parallaxMode === 'None',
      },
      renderInBackground: {
        label: 'Render sebagai Background',
        type: 'toggle',
        disabled,
      },
    },
  };

  constructor(properties?: Record<string, unknown>) {
    if (properties) {
      if (properties.useTrackArtwork === false) {
        properties.useTrackArtwork = 'None';
      } else if (properties.useTrackArtwork === true) {
        properties.useTrackArtwork = 'Active Track';
      }
      if (
        properties.useTrackArtwork &&
        properties.useTrackArtwork !== 'None' &&
        properties.opacity === 0
      ) {
        properties.opacity = 1;
      }
    }
    super(ImageDisplay, properties);

    this.image = new Image();
    const props = this.properties as Record<string, unknown>;
    this.image.src = props.src as string;
  }

  get hasImage() {
    const p = this.properties as Record<string, unknown>;
    const useArtwork = p.useTrackArtwork;
    const hasArtwork = useArtwork !== false && useArtwork !== 'None';
    return p.src !== BLANK_IMAGE || hasArtwork;
  }

  update(properties: Record<string, unknown>) {
    if (properties.useTrackArtwork === false) {
      properties.useTrackArtwork = 'None';
    } else if (properties.useTrackArtwork === true) {
      properties.useTrackArtwork = 'Active Track';
    }
    const props = this.properties as Record<string, unknown>;
    if (
      properties.useTrackArtwork &&
      properties.useTrackArtwork !== 'None' &&
      props.opacity === 0
    ) {
      properties.opacity = 1;
    }
    const { src: inputSrc, fixed, width, height } = properties;
    const { src, width: w, height: h, fixed: f } = props;
    let image: HTMLImageElement | null = null;
    let nextProperties = properties;
    const srcChanged = typeof inputSrc === 'string' && inputSrc !== src;

    // If we get an HTMLImageElement
    if (typeof inputSrc === 'object' && (inputSrc as HTMLImageElement)?.src) {
      image = inputSrc as HTMLImageElement;

      if (image.src === BLANK_IMAGE) {
        // Image reset: only clear source and size, preserve others
        nextProperties = {
          ...properties,
          src: BLANK_IMAGE,
          sourcePath: '',
          width: 0,
          height: 0,
        };
      } else if (image.src !== src) {
        // New image
        const fittedSize = getFittedSize(this, image.naturalWidth, image.naturalHeight);
        nextProperties = {
          src: image.src,
          width: fittedSize.width,
          height: fittedSize.height,
          opacity: 1,
        };
      } else {
        nextProperties.src = image.src;
      }
    }

    // Sync width/height values
    if (!image && !srcChanged && (fixed || f)) {
      const { naturalWidth, naturalHeight } = this.image;
      if (!naturalWidth || !naturalHeight) {
        return super.update({});
      }

      const ratio = naturalWidth / naturalHeight;

      if (!isDefined(width, height)) {
        if ((w as number) > (h as number)) {
          nextProperties.height = Math.round((w as number) * (1 / ratio)) || 0;
          nextProperties.width = Math.round((nextProperties.height as number) * ratio);
        } else {
          nextProperties.width = Math.round((h as number) * ratio);
          nextProperties.height = Math.round((nextProperties.width as number) * (1 / ratio)) || 0;
        }
      }

      if (width) {
        nextProperties.height = Math.round((width as number) * (1 / ratio)) || 0;
      }
      if (height) {
        nextProperties.width = Math.round((height as number) * ratio);
      }
    }

    const nextSrcChanged = typeof nextProperties.src === 'string' && nextProperties.src !== src;

    const changed = super.update(nextProperties);

    if (changed) {
      if (nextSrcChanged && nextProperties.src !== BLANK_IMAGE) {
        if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
          this.image = image;
        } else {
          const nextImage = new Image();
          nextImage.onload = () => {
            this.image = nextImage;

            const p = this.properties as Record<string, unknown>;
            const nextProps: Record<string, unknown> = {};
            if (!p.width && !p.height) {
              const fittedSize = getFittedSize(
                this,
                nextImage.naturalWidth,
                nextImage.naturalHeight,
              );
              nextProps.width = fittedSize.width;
              nextProps.height = fittedSize.height;
            }
            if (p.opacity === 0) {
              nextProps.opacity = 1;
            }

            if (Object.keys(nextProps).length > 0) {
              super.update(nextProps);
            }
          };
          nextImage.src = nextProperties.src as string;
        }
      }
    }

    return changed;
  }
}
