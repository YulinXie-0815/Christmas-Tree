import React, { useState } from 'react';
import { generateLuxuryWish } from '../services/geminiService';
import { WishState, TreeConfig, TreeMorphState } from '../types';
import { Wand2, Loader2, Sparkles, Volume2, VolumeX, Triangle, BoxSelect } from 'lucide-react';

interface OverlayProps {
  wish: WishState;
  setWish: React.Dispatch<React.SetStateAction<WishState>>;
  config: TreeConfig;
  setConfig: React.Dispatch<React.SetStateAction<TreeConfig>>;
}

const Overlay: React.FC<OverlayProps> = ({ wish, setWish, config, setConfig }) => {
  const [userName, setUserName] = useState('');
  const [muted, setMuted] = useState(false);

  const handleGenerate = async () => {
    setWish(prev => ({ ...prev, loading: true, error: null }));
    try {
      const text = await generateLuxuryWish(userName || "Valued Guest");
      setWish({ text, loading: false, error: null });
    } catch (err) {
      setWish({ text: '', loading: false, error: "The spirits are quiet..." });
    }
  };

  const toggleMorph = () => {
    setConfig(prev => ({
      ...prev,
      morphState: prev.morphState === TreeMorphState.TREE_SHAPE 
        ? TreeMorphState.SCATTERED 
        : TreeMorphState.TREE_SHAPE
    }));
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 md:p-12">
      
      {/* Header */}
      <header className="flex justify-between items-start pointer-events-auto">
        <div className="text-left">
          <h1 className="font-display text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-arix-goldLight via-arix-gold to-arix-goldDark drop-shadow-md tracking-widest uppercase">
            Arix
          </h1>
          <h2 className="font-serif text-arix-goldLight/80 text-lg md:text-xl tracking-widest mt-1">
            Signature Collection
          </h2>
        </div>
        <button 
          onClick={() => setMuted(!muted)}
          className="p-3 rounded-full border border-arix-gold/30 hover:bg-arix-gold/10 text-arix-gold transition-all duration-300 backdrop-blur-sm"
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </header>

      {/* Main Interaction Area */}
      <main className="flex flex-col items-center md:items-end w-full pointer-events-auto gap-4">
        
        {/* Morph Control - New Feature */}
        <button
          onClick={toggleMorph}
          className="group relative overflow-hidden bg-arix-emerald/20 border border-arix-gold/30 backdrop-blur-md px-6 py-3 rounded-sm transition-all hover:bg-arix-emerald/40 hover:border-arix-gold/60"
        >
           <div className="flex items-center gap-3">
             {config.morphState === TreeMorphState.TREE_SHAPE ? (
               <>
                 <BoxSelect size={18} className="text-arix-gold" />
                 <span className="font-sans text-xs uppercase tracking-[0.2em] text-arix-goldLight">Deconstruct</span>
               </>
             ) : (
               <>
                 <Triangle size={18} className="text-arix-gold rotate-180" />
                 <span className="font-sans text-xs uppercase tracking-[0.2em] text-arix-goldLight">Assemble</span>
               </>
             )}
           </div>
        </button>

        {/* The Wish Card */}
        <div className={`
          relative w-full max-w-md p-[1px] rounded-xl overflow-hidden transition-all duration-700
          ${wish.text ? 'opacity-100 translate-y-0' : 'opacity-90 translate-y-4'}
        `}>
          <div className="absolute inset-0 bg-gradient-to-br from-arix-gold via-transparent to-arix-emerald opacity-50" />
          
          <div className="relative bg-arix-dark/90 backdrop-blur-xl p-8 rounded-xl border border-arix-gold/20 shadow-2xl">
            {wish.loading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="animate-spin text-arix-gold" size={32} />
                <p className="font-serif text-arix-goldLight text-sm tracking-widest animate-pulse">Consulting the Stars...</p>
              </div>
            ) : wish.text ? (
              <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Sparkles className="mx-auto text-arix-gold mb-2" size={24} />
                <p className="font-serif text-xl md:text-2xl leading-relaxed text-arix-goldLight italic">
                  "{wish.text}"
                </p>
                <div className="w-12 h-[1px] bg-arix-gold/50 mx-auto" />
                <button 
                  onClick={() => setWish({ ...wish, text: '' })}
                  className="text-xs font-sans uppercase tracking-[0.2em] text-arix-gold/60 hover:text-arix-gold transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="block font-sans text-xs uppercase tracking-[0.2em] text-arix-gold/60">
                    Recipient Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter name..."
                    className="w-full bg-black/20 border-b border-arix-gold/30 text-arix-goldLight p-2 focus:outline-none focus:border-arix-gold transition-colors font-serif placeholder:text-arix-gold/20 placeholder:italic"
                  />
                </div>
                
                <button
                  onClick={handleGenerate}
                  className="group relative w-full overflow-hidden rounded-sm bg-arix-gold/10 px-6 py-4 transition-all hover:bg-arix-gold/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-arix-gold/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <div className="flex items-center justify-center gap-3">
                    <Wand2 size={18} className="text-arix-gold" />
                    <span className="font-sans text-sm uppercase tracking-[0.2em] text-arix-goldLight font-medium">
                      Generate Wish
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="flex justify-between items-end pointer-events-auto">
        <div className="hidden md:block">
           <div className="flex gap-4">
             <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase text-arix-gold/50 font-sans tracking-widest">Rotation</span>
               <input 
                 type="range" 
                 min="0" 
                 max="2" 
                 step="0.1" 
                 value={config.rotationSpeed}
                 onChange={(e) => setConfig({...config, rotationSpeed: parseFloat(e.target.value)})}
                 className="w-24 accent-arix-gold h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
               />
             </div>
             <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase text-arix-gold/50 font-sans tracking-widest">Glow</span>
               <input 
                 type="range" 
                 min="0.5" 
                 max="2.5" 
                 step="0.1" 
                 value={config.bloomIntensity}
                 onChange={(e) => setConfig({...config, bloomIntensity: parseFloat(e.target.value)})}
                 className="w-24 accent-arix-gold h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
               />
             </div>
           </div>
        </div>
        
        <div className="text-right">
          <p className="font-sans text-[10px] text-arix-gold/40 tracking-[0.3em] uppercase">
            Est. 2024 • Arix Interactive
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Overlay;