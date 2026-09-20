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

  });

  describe('FOLDER_COLORS', () => {

    it('should include default gray color first', () => {
      expect(FOLDER_COLORS[0]).toBe('#6B7280');
    });

  });

  describe('isEmojiIcon', () => {
    // Emojis are no longer supported for folders — isEmojiIcon always returns false.

    it('should return false for emoji characters (emojis no longer supported)', () => {
      expect(isEmojiIcon('📁')).toBe(false);
      expect(isEmojiIcon('⭐')).toBe(false);
      expect(isEmojiIcon('🎯')).toBe(false);
      expect(isEmojiIcon('💼')).toBe(false);
    });

  });

  describe('getIconComponent', () => {
    it('should return RiFolderLine for null', () => {
      const result = getIconComponent(null);
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
