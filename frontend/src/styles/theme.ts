import { DefaultTheme } from 'styled-components';

export const theme: DefaultTheme = {
  colors: {
    background: '#ffffff',
    foreground: 'rgb(255, 255, 255)',
    text: '#000000',
    primary: '#8B5CF6',
    primaryDark: '#7C3AED',
    primaryLight: '#A78BFA',
    secondary: '#6366F1',
    accent: '#10B981',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#FF4444',
    info: '#3B82F6',
    glassBg: 'rgba(255, 255, 255, 0.06)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    cardBg: 'rgba(30, 31, 46, 0.8)',
    inputBg: 'rgba(255, 255, 255, 0.08)',
  },
  shadows: {
    glowShadow: 'rgba(139, 92, 246, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  borderRadius: {
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
  transitions: {
    fast: '0.15s ease',
    medium: '0.3s ease',
    slow: '0.5s ease',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.5rem',
  },
  fonts: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    mono: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
};
