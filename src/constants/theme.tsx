import React, { createContext, useState, useContext } from 'react';

// 🔹 1. COLORS OBJECT YAHIN PAR HAI
export const COLORS = {
  light: {
    primary: "#3B82F6",      // Blue
    secondary: "#60A5FA",    
    background: "#F8FAFC",   // Light gray bg
    cardBg: "#FFFFFF",       // White cards
    textMain: "#1E293B",     // Dark text
    textSub: "#64748B",      // Gray text
    border: "#E2E8F0",       // Light border
  },
  dark: {
    primary: "#3B82F6",      // Blue same rahega
    secondary: "#60A5FA",    
    background: "#0F172A",   // Dark bg
    cardBg: "#1E293B",       // Dark cards
    textMain: "#F8FAFC",     // White text
    textSub: "#94A3B8",      // Light gray text
    border: "#334155",       // Dark border
  }
};

// 🔹 2. THEME CONTEXT BHI YAHIN HAI
const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: any) => {
  const [isLightMode, setIsLightMode] = useState(true);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
  };

  const themeColors = isLightMode ? COLORS.light : COLORS.dark;

  return (
    <ThemeContext.Provider value={{ isLightMode, toggleTheme, colors: themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);