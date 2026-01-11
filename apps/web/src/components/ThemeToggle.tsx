import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '8px 12px',
        cursor: 'pointer',
        color: 'var(--color-text-primary)',
        fontSize: '14px',
      }}
    >
      {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
};