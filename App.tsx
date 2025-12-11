import React, { useState, Suspense } from 'react';
import TreeScene from './components/TreeScene';
import Overlay from './components/Overlay';
import { WishState, TreeConfig, TreeMorphState } from './types';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [wish, setWish] = useState<WishState>({
    text: '',
    loading: false,
    error: null
  });

  const [config, setConfig] = useState<TreeConfig>({
    rotationSpeed: 0.3,
    bloomIntensity: 1.5,
    lightsColor: '#FFFAEE',
    morphState: TreeMorphState.TREE_SHAPE
  });

  return (
    <div className="w-full h-full relative bg-arix-dark overflow-hidden selection:bg-arix-gold/30 selection:text-white">
      {/* Background Gradient to give depth behind the 3D scene */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-arix-emerald/20 via-arix-dark to-black z-0" />
      
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center text-arix-gold">
            <Loader2 className="animate-spin" size={48} />
          </div>
        }>
          <TreeScene config={config} />
        </Suspense>
      </div>

      {/* UI Overlay */}
      <Overlay 
        wish={wish} 
        setWish={setWish}
        config={config}
        setConfig={setConfig}
      />
    </div>
  );
};

export default App;