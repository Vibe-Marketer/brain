import { RiMoonLine, RiSunLine } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

const themes = [
  {
    key: 'light',
    icon: RiSunLine,
    label: 'Light theme',
  },
  {
    key: 'dark',
    icon: RiMoonLine,
    label: 'Dark theme',
  },
];

export const ThemeSwitcher = () => {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const handleThemeClick = useCallback(
    (themeKey: 'light' | 'dark') => {
      if (theme !== themeKey) {
        toggleTheme();
      }
    },
    [theme, toggleTheme]
  );

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative isolate flex h-8 rounded-full bg-muted/50 p-1 ring-1 ring-border cursor-pointer'
      )}
      onClick={() => handleThemeClick(theme === 'light' ? 'dark' : 'light')}
    >
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = theme === key;
        return (
          <div
            key={key}
            aria-label={label}
            className="relative h-6 w-6 rounded-full transition-colors flex items-center justify-center"
          >
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-full bg-primary"
                layoutId="activeTheme"
                transition={{ type: 'spring', duration: 0.5 }}
              />
            )}
            <Icon
              className={cn(
                'relative z-10 h-4 w-4',
                isActive ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            />
          </div>
        );
      })}
    </div>
  );
};
