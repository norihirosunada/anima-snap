import { useState, useCallback } from 'react';
import { CaptureScreen } from './components/capture/CaptureScreen';
import { CollectionList } from './components/collection/CollectionList';
import { ChatScreen } from './components/chat/ChatScreen';
import { ObjectDetail } from './components/detail/ObjectDetail';
import { SplashScreen } from './components/splash/SplashScreen';

import { AdminScreen } from './components/admin/AdminScreen';
import { deleteObject } from './lib/storage';
import type { AnimismObject, AppScreen } from './lib/types';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<AppScreen>('capture');
  const [selectedObject, setSelectedObject] = useState<AnimismObject | null>(null);
  const [collectionRefresh, setCollectionRefresh] = useState(0);

  const handleObjectRegistered = useCallback((obj: AnimismObject) => {
    setSelectedObject(obj);
    setCollectionRefresh((n) => n + 1);
    setScreen('detail');
  }, []);

  const handleSelectObject = useCallback((obj: AnimismObject) => {
    setSelectedObject(obj);
    setScreen('detail');
  }, []);

  const handleOpenCollection = useCallback(() => {
    setScreen('collection');
  }, []);

  const handleDeleteObject = useCallback((id: string) => {
    deleteObject(id);
    setSelectedObject(null);
    setCollectionRefresh((n) => n + 1);
    setScreen('collection');
  }, []);

  const handleBack = useCallback(() => {
    if (screen === 'detail') {
      setScreen(selectedObject ? 'collection' : 'capture');
    } else if (screen === 'chat') {
      setScreen('detail');
    } else {
      setScreen('capture');
    }
  }, [screen, selectedObject]);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className="relative w-full h-full bg-black">
        {/* Hidden Admin Button (Top Left) — only on capture screen to avoid overlapping back buttons */}
        {screen === 'capture' && (
          <button
            onClick={() => setScreen('admin')}
            className="absolute top-0 left-0 w-16 h-16 z-50 opacity-0"
            aria-label="Admin Interface"
          />
        )}

        {/* Screens */}
        <div className="absolute inset-0" style={{ display: screen === 'capture' ? 'block' : 'none' }}>
          <CaptureScreen
            onObjectRegistered={handleObjectRegistered}
            onOpenCollection={handleOpenCollection}
          />
        </div>

        {screen === 'collection' && (
          <div className="absolute inset-0">
            <CollectionList
              onSelectObject={handleSelectObject}
              onBack={() => setScreen('capture')}
              refreshTrigger={collectionRefresh}
            />
          </div>
        )}

        {screen === 'detail' && selectedObject && (
          <div className="absolute inset-0">
            <ObjectDetail
              object={selectedObject}
              onBack={handleBack}
              onChat={() => setScreen('chat')}
              onDelete={handleDeleteObject}
            />
          </div>
        )}

        {screen === 'chat' && selectedObject && (
          <div className="absolute inset-0">
            <ChatScreen
              object={selectedObject}
              onBack={handleBack}
            />
          </div>
        )}

        {screen === 'admin' && (
          <div className="absolute inset-0 z-50">
            <AdminScreen onBack={() => setScreen('capture')} />
          </div>
        )}

        {/* Bottom navigation removed per design update */}
      </div>
    </>
  );
}
