import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'small' | 'medium' | 'large';

interface AccessibilityContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const stored = localStorage.getItem('fontSize');
    if (stored === 'small' || stored === 'medium' || stored === 'large') return stored;
    return 'medium';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  return (
    <AccessibilityContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return context;
};