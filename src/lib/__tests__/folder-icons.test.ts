import { describe, it, expect } from 'vitest';
import {
  FOLDER_ICON_OPTIONS,
  FOLDER_COLORS,
  isEmojiIcon,
  getIconComponent,
} from '../folder-icons';
import { RiFolderLine } from '@remixicon/react';

describe('folder-icons utilities', () => {
  describe('FOLDER_ICON_OPTIONS', () => {
    it('should export a non-empty array of icon options', () => {
      expect(Array.isArray(FOLDER_ICON_OPTIONS)).toBe(true);
      expect(FOLDER_ICON_OPTIONS.length).toBeGreaterThan(0);
    });

    it('each option should have required properties', () => {
      FOLDER_ICON_OPTIONS.forEach((option) => {
        expect(option).toHaveProperty('id');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('icon');
        expect(option).toHaveProperty('category');
        expect(typeof option.id).toBe('string');
        expect(typeof option.label).toBe('string');
        expect(typeof option.icon).toBe('function');
        expect(typeof option.category).toBe('string');
      });
    });

    it('should include common folder icons', () => {
      const ids = FOLDER_ICON_OPTIONS.map((opt) => opt.id);
      expect(ids).toContain('folder');
      expect(ids).toContain('folder-open');
      expect(ids).toContain('file-text');
      expect(ids).toContain('briefcase');
    });

    it('should have unique IDs', () => {
      const ids = FOLDER_ICON_OPTIONS.map((opt) => opt.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories', () => {
      const validCategories = [
        'folders',
        'business',
        'documents',
        'organization',
        'markers',
        'people',
        'ideas',
        'data',
        'security',
        'nature',
        'misc',
      ];

      FOLDER_ICON_OPTIONS.forEach((option) => {
        expect(validCategories).toContain(option.category);
      });
    });
  });

  describe('FOLDER_COLORS', () => {
    it('should export an array of color hex codes', () => {
      expect(Array.isArray(FOLDER_COLORS)).toBe(true);
      expect(FOLDER_COLORS.length).toBeGreaterThan(0);
    });

    it('all colors should be valid hex codes', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      FOLDER_COLORS.forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });

    it('should include default gray color first', () => {
      expect(FOLDER_COLORS[0]).toBe('#6B7280');
    });

    it('should have unique colors', () => {
      const uniqueColors = new Set(FOLDER_COLORS);
      expect(uniqueColors.size).toBe(FOLDER_COLORS.length);
    });
  });

  describe('isEmojiIcon', () => {
    it('should return false for null', () => {
      expect(isEmojiIcon(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEmojiIcon(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEmojiIcon('')).toBe(false);
    });

    it('should return false for known icon IDs', () => {
      expect(isEmojiIcon('folder')).toBe(false);
      expect(isEmojiIcon('folder-open')).toBe(false);
      expect(isEmojiIcon('file-text')).toBe(false);
      expect(isEmojiIcon('briefcase')).toBe(false);
      expect(isEmojiIcon('star')).toBe(false);
    });

    it('should return true for emoji characters', () => {
      expect(isEmojiIcon('📁')).toBe(true);
      expect(isEmojiIcon('⭐')).toBe(true);
      expect(isEmojiIcon('🎯')).toBe(true);
      expect(isEmojiIcon('💼')).toBe(true);
    });

    it('should return true for strings not in icon list', () => {
      expect(isEmojiIcon('random-string')).toBe(true);
      expect(isEmojiIcon('not-an-icon')).toBe(true);
    });

    it('should handle multi-character emojis', () => {
      expect(isEmojiIcon('👨‍💻')).toBe(true);
      expect(isEmojiIcon('🏳️‍🌈')).toBe(true);
    });
  });

  describe('getIconComponent', () => {
    it('should return RiFolderLine for null', () => {
      const result = getIconComponent(null);
      expect(result).toBe(RiFolderLine);
    });

    it('should return RiFolderLine for undefined', () => {
      const result = getIconComponent(undefined);
      expect(result).toBe(RiFolderLine);
    });

    it('should return RiFolderLine for empty string', () => {
      // Empty string is falsy, so it returns the default
      const result = getIconComponent('');
      expect(result).toBe(RiFolderLine);
    });

    it('should return correct icon component for known icon IDs', () => {
      const folderIcon = getIconComponent('folder');
      expect(folderIcon).toBe(RiFolderLine);

      const folderOpenIcon = getIconComponent('folder-open');
      expect(folderOpenIcon).not.toBeNull();
      expect(typeof folderOpenIcon).toBe('function');
    });

    it('should return RiFolderLine for unknown icon IDs', () => {
      const result = getIconComponent('unknown-icon-id');
      expect(result).toBe(RiFolderLine);
    });

    it('should return RiFolderLine for emoji values', () => {
      // Emojis are not in the icon list, so they fall back to default
      const result = getIconComponent('📁');
      expect(result).toBe(RiFolderLine);
    });

    it('should return a valid React component', () => {
      const Icon = getIconComponent('folder');
      expect(typeof Icon).toBe('function');
      // Check it can be called (it's a component)
      expect(Icon.name).toBeDefined();
    });

    it('should return different icons for different IDs', () => {
      const folder = getIconComponent('folder');
      const briefcase = getIconComponent('briefcase');
      const star = getIconComponent('star');

      // Different icon IDs should return different components
      expect(briefcase).not.toBe(folder);
      expect(star).not.toBe(folder);
      expect(star).not.toBe(briefcase);
    });
  });
});
