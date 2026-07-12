import { clsx as classNames } from 'cnfast';
import React from 'react';
import { useTranslation } from 'react-i18next';
import useAudioStore from '@/app/actions/audio';
import Option from '@/app/components/controls/Option';
import useEntity from '@/app/hooks/useEntity';
import { translateControlProps, translateGeneratedName, translateLabel } from '@/i18n/labels';
import type Display from '@/lib/core/Display';
import { resolve } from '@/lib/utils/object';
import { inputValueToProps } from '@/lib/utils/react';

interface ControlProps {
  display: Display & {
    id: string;
    displayName: string;
    properties: Record<string, unknown>;
    constructor: {
      config: {
        label: string;
        controls?: Record<string, Record<string, unknown>>;
      };
    };
  };
  className?: string;
  showHeader?: boolean;
  active?: boolean;
  onChange?: (props: Record<string, unknown>) => void;
  onNameClick?: (id: string) => void;
}

export default function Control({
  display,
  className,
  showHeader = true,
  active = false,
  onChange: onChangeProp,
  onNameClick,
}: ControlProps) {
  const { t } = useTranslation();
  useAudioStore(state => state.playlist);
  const {
    id,
    displayName,
    constructor: {
      config: { label, controls = {} },
    },
  } = display;

  const configName = display.constructor.config.name;

  const [presets, setPresets] = React.useState<Record<string, Record<string, any>>>(() => {
    try {
      const saved = localStorage.getItem(`astrofox:layer-presets:${configName}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [selectedPresetName, setSelectedPresetName] = React.useState('');

  // Reload presets if display type changes
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`astrofox:layer-presets:${configName}`);
      setPresets(saved ? JSON.parse(saved) : {});
      setSelectedPresetName('');
    } catch {
      setPresets({});
    }
  }, [configName]);

  const handleSavePreset = () => {
    const name = prompt(t('Masukkan nama preset baru:'));
    if (!name) return;
    
    const updated = {
      ...presets,
      [name]: { ...display.properties },
    };
    
    localStorage.setItem(`astrofox:layer-presets:${configName}`, JSON.stringify(updated));
    setPresets(updated);
    setSelectedPresetName(name);
  };

  const handleDeletePreset = (nameToDelete: string) => {
    if (!nameToDelete) return;
    if (!confirm(`Hapus preset "${nameToDelete}"?`)) return;
    
    const updated = { ...presets };
    delete updated[nameToDelete];
    
    localStorage.setItem(`astrofox:layer-presets:${configName}`, JSON.stringify(updated));
    setPresets(updated);
    setSelectedPresetName('');
  };

  const handleSelectPreset = (name: string) => {
    setSelectedPresetName(name);
    if (presets[name]) {
      onChange(presets[name]);
    }
  };

  const internalOnChange = useEntity(display);
  const onChange = onChangeProp ?? internalOnChange;

  function resolveOption(name: string, option: Record<string, unknown>) {
    const props: Record<string, unknown> = {};

    for (const [propName, value] of Object.entries(option)) {
      props[propName] = resolve(value, [display]);
    }

    if (props.hidden) {
      return null;
    }

    const translatedProps = translateControlProps(t, props);

    return {
      name,
      group:
        typeof translatedProps.group === 'string' && translatedProps.group.trim().length > 0
          ? translatedProps.group
          : null,
      props: translatedProps,
    };
  }

  // Collapsed states for accordions (default closed/collapsed)
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const getAutoGroup = (name: string, optionProps: Record<string, unknown>): string => {
    if (typeof optionProps.group === 'string' && optionProps.group.trim().length > 0) {
      return optionProps.group;
    }
    
    const lowerName = name.toLowerCase();
    
    if (
      lowerName.includes('wave') || 
      lowerName.includes('ripple') || 
      lowerName.includes('frequency') || 
      lowerName.includes('freq') ||
      lowerName.includes('horizon') ||
      lowerName.includes('helix') ||
      lowerName.includes('spectra') ||
      lowerName.includes('lines') ||
      lowerName.includes('binaural')
    ) {
      return 'Wave & Ripples';
    }

    if (
      lowerName.includes('audio') || 
      lowerName.includes('beat') || 
      lowerName.includes('pulse') || 
      lowerName.includes('sensitivity') || 
      lowerName.includes('react') ||
      optionProps.withReactor
    ) {
      return 'Audio & Beat Reactions';
    }
    
    if (lowerName.includes('parallax')) {
      return 'Parallax Settings';
    }

    if (
      lowerName === 'x' || 
      lowerName === 'y' || 
      lowerName === 'z' ||
      lowerName.includes('offset') ||
      lowerName === 'width' || 
      lowerName === 'height' || 
      lowerName === 'zoom' || 
      lowerName === 'scale' || 
      lowerName === 'radius' || 
      lowerName === 'rotation' || 
      lowerName === 'opacity' || 
      lowerName === 'fixed' || 
      lowerName === 'renderinbackground'
    ) {
      return 'Layout & Transform';
    }

    if (
      lowerName.includes('color') ||
      lowerName.includes('glow') ||
      lowerName.includes('wireframe') ||
      lowerName.includes('particles') ||
      lowerName.includes('spark') ||
      lowerName.includes('detail')
    ) {
      return 'Visual Styles & Colors';
    }

    return 'General Settings';
  };

  const visibleOptions = Object.keys(controls)
    .map(key => resolveOption(key, controls[key]))
    .filter(
      (
        option,
      ): option is {
        name: string;
        group: string | null;
        props: Record<string, unknown>;
      } => option !== null,
    );

  // Group visible options
  const groups = React.useMemo(() => {
    const grouped: Record<string, typeof visibleOptions> = {};
    for (const option of visibleOptions) {
      const gName = getAutoGroup(option.name, option.props);
      if (!grouped[gName]) {
        grouped[gName] = [];
      }
      grouped[gName].push(option);
    }
    return grouped;
  }, [visibleOptions]);

  return (
    <div className={classNames('pb-2', className)}>
      {showHeader && (
        <div className={'relative py-3 px-2.5'}>
          <div
            className={
              'flex items-center justify-between text-xs text-neutral-100 overflow-hidden gap'
            }
          >
            <div className="flex items-center gap-2">
              <div
                className="inline-flex border-b-2 border-b-transparent uppercase"
                style={{
                  borderBottomColor: active ? 'var(--color-primary)' : 'transparent',
                }}
              >
                {translateLabel(t, label)}
              </div>
            </div>
            <button
              type="button"
              className={classNames(
                'min-w-0 max-w-24 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap hover:text-neutral-100',
                {
                  'text-neutral-100': active,
                  'text-neutral-300': !active,
                },
              )}
              onClick={() => onNameClick?.(id)}
            >
              {translateGeneratedName(t, displayName)}
            </button>
          </div>
        </div>
      )}

      {/* ── Custom Layer Preset Controls ── */}
      <div className="mx-2.5 mb-3 flex items-center justify-between gap-1.5 rounded bg-neutral-900/60 p-1.5 border border-neutral-700/40">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <select
            value={selectedPresetName}
            onChange={e => handleSelectPreset(e.target.value)}
            className="h-6 w-full rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0 text-[10px] text-neutral-300 outline-none focus:border-violet-500"
          >
            <option value="">-- Load Preset --</option>
            {Object.keys(presets).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={handleSavePreset}
            className="rounded bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 hover:bg-violet-600 hover:text-white transition-all h-6"
            title="Simpan setelan saat ini sebagai preset kustom"
          >
            Simpan
          </button>
          {selectedPresetName && (
            <button
              type="button"
              onClick={() => handleDeletePreset(selectedPresetName)}
              className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-900/40 transition-all h-6"
              title="Hapus preset terpilih"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Accordion sections (grouped) */}
      <div className="flex flex-col gap-2 px-2.5">
        {Object.entries(groups).map(([groupName, options]) => {
          const isOpen = !!openGroups[groupName];
          return (
            <div key={groupName} className="rounded border border-neutral-700 bg-neutral-900/10 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between px-2.5 py-2 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-300 hover:text-white hover:bg-neutral-800/50 transition-all cursor-pointer select-none"
              >
                <span>{groupName}</span>
                <span className="text-[7px] text-neutral-400 transition-transform duration-200" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }}>
                  ▼
                </span>
              </button>
              
              {isOpen && (
                <div className="flex flex-col py-1 border-t border-neutral-800/80 bg-neutral-950/20">
                  {options.map(option => {
                    const { group: _group, ...optionProps } = option.props;
                    return (
                      <Option
                        key={option.name}
                        display={display}
                        name={option.name}
                        value={(display.properties as Record<string, unknown>)[option.name]}
                        onChange={inputValueToProps(onChange)}
                        {...optionProps}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
