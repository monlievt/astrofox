import React from 'react';
import { useTranslation } from 'react-i18next';
import { applyPresetTemplate, saveCustomPreset, deleteCustomPreset } from '@/app/actions/project';
import PanelHeader from '@/app/components/panels/PanelHeader';
import {
  Sparkles,
  CircleDot,
  BarChart3,
  Music2,
  Zap,
  Activity,
  Disc,
  Orbit,
  Grid,
  Sun,
  Save,
  Trash2,
  Bookmark,
} from 'lucide-react';

interface PresetItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  themeColor: string;
  details: string[];
}

export default function TemplatesPanel() {
  const { t } = useTranslation();

  const presets: PresetItem[] = [
    {
      id: 'trap-nation',
      name: 'Trap Nation Style',
      description: 'Circular outward spectrum dengan particle starfield. Mirror mode aktif — bar 180° di-mirror.',
      icon: CircleDot,
      themeColor: 'from-[#704dd8] to-[#ff007f]',
      details: [
        'Mirror mode: 180° spectrum dimirroring (on by default)',
        'Ambient starfield background',
        '💡 Tambah layer Image untuk center logo pulsing',
      ],
    },
    {
      id: 'ncs',
      name: 'NCS Style Visualizer',
      description: 'Circular equalizer dengan screen shake saat bass drop & color morphing otomatis.',
      icon: Sparkles,
      themeColor: 'from-[#00d2ff] to-[#3a7bd5]',
      details: [
        'Dynamic color morphing gradient (auto)',
        'Bass drop screen-shake animation',
        'Wave spectrum sebagai latar halus',
      ],
    },
    {
      id: 'monstercat',
      name: 'Monstercat Style',
      description: 'Vertical bar equalizer minimalis dengan falling snow/dust particle ambient.',
      icon: BarChart3,
      themeColor: 'from-[#11998e] to-[#38ef7d]',
      details: [
        'Vertical bar spectrum (bottom aligned)',
        'Ambient starfield background biru',
        'Falling snow/dust particle overlay',
      ],
    },
    {
      id: 'chill-lofi',
      name: 'Chill Lo-Fi Vibes',
      description: 'Waveform ring halus dengan fluid background untuk musik santai & ambient.',
      icon: Music2,
      themeColor: 'from-[#6a52c8] to-[#b8a9f0]',
      details: [
        'Fluid flow background bergerak lambat',
        'Waveform ring di tengah (smooth)',
        'Soundwave horizontal tipis di bawah',
      ],
    },
    {
      id: 'edm-club',
      name: 'EDM Club Drop',
      description: 'Tunnel 3D reaktif dengan warp-speed starfield cyan dan bar spectrum bawah.',
      icon: Zap,
      themeColor: 'from-[#00ffff] to-[#ff00ff]',
      details: [
        '3D Tunnel reaktif (bass + beat)',
        'Warp-speed cyan starfield background',
        'Bar spectrum bawah (cyan–magenta)',
      ],
    },
    {
      id: 'vissonance-sphere-preset',
      name: 'Vissonance Sphere',
      description: 'Sphere wireframe 3D neon yang berdenyut dan terdistorsi oleh getaran audio.',
      icon: Orbit,
      themeColor: 'from-[#f59e0b] to-[#ec4899]',
      details: [
        '3D wireframe sphere dengan perspective projection',
        'Audio-driven vertex displacement',
        'Ambient starfield particles',
      ],
    },
    {
      id: 'morphing-orb-preset',
      name: 'Fluid Morphing Orb',
      description: 'Orb solid 3D abstrak dengan shader gradasi dinamis yang meleleh mengikuti beat musik.',
      icon: Disc,
      themeColor: 'from-[#8b5cf6] to-[#ec4899]',
      details: [
        'Solid displaced 3D sphere',
        'Audio-driven fluid surface ripples',
        'Deep space flow background',
      ],
    },
    {
      id: 'led-wall-preset',
      name: 'Vibrant LED Wall',
      description: 'Equalizer bar berskala besar ala LED VU meter klasik dengan concentric ripple rings di latar belakang.',
      icon: Grid,
      themeColor: 'from-[#10b981] to-[#f59e0b]',
      details: [
        'Classic 3-stop color LED panel segment display',
        'Frequency Ripple Rings as space background',
        'Particle Burst beat reactive particles',
      ],
    },
    {
      id: 'particle-galaxy',
      name: 'Hypnotic Particle Galaxy',
      description: 'Partikel galaksi konsentris 3D yang berputar melingkar mengitari inti orbital yang membara. Sangat cocok untuk jenis musik Gamma Wave & Binaural Beats.',
      icon: Sun,
      themeColor: 'from-[#8b5cf6] to-[#06b6d4]',
      details: [
        'Core 3D pulsating particle core',
        'Concentric particle rings with wave ripples',
        'Ambient deep space starfield',
      ],
    },
    {
      id: 'particle-terrain-preset',
      name: 'Waving Particle Terrain',
      description: 'Grid landscape partikel 3D bercahaya yang bergelombang dan mengalir mengikuti frekuensi musik (seperti bukit cahaya). Memberikan atmosfer rileks dan meditatif.',
      icon: Activity,
      themeColor: 'from-[#00ffcc] to-[#7000ff]',
      details: [
        '3D perspective terrain wave grid',
        'GPU-accelerated simplex noise wave movement',
        'Audio-driven high-frequency ripples',
      ],
    },
    {
      id: 'spectrogram-terrain-preset',
      name: 'Spectrogram Terrain (3D)',
      description: 'Lanskap partikel 3D reaktif di mana frekuensi audio melesat vertikal di tengah dan mengalir berjalan horisontal dari kanan ke kiri seiring berjalannya lagu.',
      icon: BarChart3,
      themeColor: 'from-[#a855f7] to-[#00f0ff]',
      details: [
        'Real-time scrolling 3D spectrogram waterfall',
        'Dynamic height peaks driven directly by audio frequencies',
        'Full 3D depth fade particle scaling',
      ],
    },
    {
      id: 'sacred-mandala-preset',
      name: 'Glowing Sacred Mandala',
      description: 'Pola geometri sakral konsentris (Flower of Life & Polygon) yang membesar, mengecil, dan berputar secara simetris dalam pendaran cahaya neon yang indah.',
      icon: Orbit,
      themeColor: 'from-[#ff0055] to-[#7000ff]',
      details: [
        'Symmetric overlapping sacred geometry circles',
        'Concentric polygonal layers rotating in opposite directions',
        'Independent frequency band audio pulsing',
      ],
    },
  ];


  const [customPresets, setCustomPresets] = React.useState<PresetItem[]>([]);

  React.useEffect(() => {
    const raw = localStorage.getItem('astrofox_custom_presets');
    if (raw) {
      setCustomPresets(JSON.parse(raw));
    }
  }, []);

  async function handleApply(presetId: string) {
    if (confirm('Apply this template? Your current visualizer layers will be replaced.')) {
      await applyPresetTemplate(presetId);
    }
  }

  const handleCreatePreset = () => {
    const name = prompt('Masukkan nama untuk preset kustom Anda:');
    if (!name || !name.trim()) return;
    const newPreset = saveCustomPreset(name);
    // Map custom preset format to PresetItem
    const mappedPreset: PresetItem = {
      id: newPreset.id,
      name: newPreset.name,
      description: newPreset.description,
      icon: Bookmark,
      themeColor: newPreset.themeColor,
      details: newPreset.details,
    };
    setCustomPresets(prev => [...prev, mappedPreset]);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Hapus preset kustom ini?')) {
      deleteCustomPreset(id);
      setCustomPresets(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-neutral-900">
      <PanelHeader title="Preset Templates" />

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5 scrollbar-thin">
        {/* Action Button to Save Custom Preset */}
        <button
          type="button"
          onClick={handleCreatePreset}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(124,58,237,0.25)]"
        >
          <Save size={14} />
          Simpan Preset Kustom Baru
        </button>

        <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
          Pilih gaya visualizer di bawah. Template akan otomatis membangun layer-layer reaktif di scene aktif.
        </p>

        {/* CUSTOM PRESETS SECTION */}
        {customPresets.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-violet-400 tracking-wider uppercase">
              Preset Anda ({customPresets.length})
            </h4>
            <div className="space-y-3">
              {customPresets.map(preset => {
                const Icon = preset.icon || Bookmark;

                return (
                  <div
                    key={preset.id}
                    className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition-all duration-300 hover:border-neutral-700 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-pink-500 opacity-80" />
                    
                    {/* Delete icon button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeletePreset(preset.id, e)}
                      className="absolute top-3.5 right-3.5 p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Hapus preset"
                    >
                      <Trash2 size={13} />
                    </button>

                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-violet-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="pr-6">
                        <h3 className="text-xs font-bold text-neutral-100 group-hover:text-white transition-colors">
                          {preset.name}
                        </h3>
                        <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleApply(preset.id)}
                      className="mt-3.5 w-full h-7 flex items-center justify-center rounded-lg text-[10px] font-semibold text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      Apply Preset
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DEFAULT TEMPLATES SECTION */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-neutral-500 tracking-wider uppercase">
            Template Bawaan
          </h4>
          <div className="space-y-3">
            {presets.map(preset => {
              const Icon = preset.icon;

              return (
                <div
                  key={preset.id}
                  className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition-all duration-300 hover:border-neutral-700 hover:shadow-[0_0_20px_rgba(119,95,216,0.15)]"
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${preset.themeColor} opacity-70 group-hover:opacity-100 transition-opacity`}
                  />

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 group-hover:text-white transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-neutral-100 group-hover:text-white transition-colors">
                        {preset.name}
                      </h3>
                      <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleApply(preset.id)}
                    className={`mt-3.5 w-full h-7 flex items-center justify-center rounded-lg text-[10px] font-semibold text-white bg-gradient-to-r ${preset.themeColor} hover:brightness-110 active:scale-[0.98] transition-all`}
                  >
                    Apply Preset
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

