import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      background: string;
      foreground: string;
      text: string;
      primary: string;
      primaryDark: string;
      primaryLight: string;
      secondary: string;
      accent: string;
      success: string;
      warning: string;
      error: string;
      info: string;
      glassBg: string;
      glassBorder: string;
      cardBg: string;
      inputBg: string;
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
