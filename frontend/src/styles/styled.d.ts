import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      background: string;
      backgroundDark: string;
      foreground: string;
      text: string;
      textSecondary: string;
      textTertiary: string;
      primary: string;
      primaryDark: string;
      primaryLight: string;
      secondary: string;
      accent: string;
      success: string;
      successDark: string;
      warning: string;
      warningDark: string;
      error: string;
      errorDark: string;
      info: string;
      infoDark: string;
      glassBg: string;
      glassBorder: string;
      cardBg: string;
      cardBackground: string;
      inputBg: string;
      inputBackground: string;
      border: string;
    };
    shadows: {
      glowShadow: string;
      boxShadow: string;
      textShadow: string;
    };
    borderRadius: {
      sm: string;
      md: string;
      lg: string;
    };
    transitions: {
      fast: string;
      medium: string;
      slow: string;
    };
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    fonts: {
      sans: string;
      mono: string;
    };
  }
}
