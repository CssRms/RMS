import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadFeatureFlag } from '../lib/featureFlag';

const AIFeaturesContext = createContext({ aiEnabled: false, refreshAI: () => {} });

export const useAIFeatures = () => useContext(AIFeaturesContext);

export const AIFeaturesProvider = ({ children }) => {
  // Starts `null` (unknown) so AI buttons stay hidden until the real setting loads —
  // defaulting to `true` flashes every AI button visible then hides it when disabled.
  const [aiEnabled, setAiEnabled] = useState(null);

  const fetchSetting = useCallback(async () => {
    // Skip if not authenticated — avoids 401 → refresh → reload loop on login screen
    if (!localStorage.getItem('rms_user')) return;
    // Falls back to the last known good cached value on a network failure, not blindly
    // to "enabled" — so a feature an admin disabled doesn't get exposed by a network blip.
    setAiEnabled(await loadFeatureFlag('ai_features_enabled'));
  }, []);

  useEffect(() => {
    fetchSetting();
    // Poll every 15 s so changes made by admin propagate without a page reload
    const interval = setInterval(fetchSetting, 15000);
    return () => clearInterval(interval);
  }, [fetchSetting]);

  return (
    <AIFeaturesContext.Provider value={{ aiEnabled, refreshAI: fetchSetting }}>
      {children}
    </AIFeaturesContext.Provider>
  );
};
