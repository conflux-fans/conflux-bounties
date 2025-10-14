import { cn } from './utils';

describe('utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      expect(cn('px-2', 'py-1', 'bg-blue-500')).toBe('px-2 py-1 bg-blue-500');
    });

    it('should handle conditional classes', () => {
      expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class');
      expect(cn('base-class', false && 'conditional-class')).toBe('base-class');
    });

    it('should handle object notation', () => {
      expect(cn('base-class', { 'active': true, 'disabled': false })).toBe('base-class active');
      expect(cn('base-class', { 'active': false, 'disabled': true })).toBe('base-class disabled');
    });

    it('should handle array notation', () => {
      expect(cn('base-class', ['nested', 'classes'])).toBe('base-class nested classes');
      expect(cn(['first', 'second'], 'third')).toBe('first second third');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null, undefined, '')).toBe('');
    });

    it('should handle mixed input types', () => {
      expect(cn('base', true && 'active', { 'disabled': false }, ['nested'])).toBe('base active nested');
    });

    it('should handle Tailwind class conflicts', () => {
      // tailwind-merge should resolve conflicts
      expect(cn('px-2 px-4')).toBe('px-4'); // px-4 should override px-2
      expect(cn('text-red-500 text-blue-500')).toBe('text-blue-500'); // text-blue-500 should override text-red-500
    });

    it('should handle complex combinations', () => {
      const isActive = true;
      const isDisabled = false;
      const size = 'lg';
      
      const result = cn(
        'base-button',
        'px-4 py-2 rounded',
        isActive && 'bg-blue-500 text-white',
        isDisabled && 'opacity-50 cursor-not-allowed',
        size === 'lg' && 'text-lg px-6 py-3'
      );
      
      // tailwind-merge will remove conflicting classes, so px-4 and py-2 will be overridden by px-6 and py-3
      expect(result).toBe('base-button rounded bg-blue-500 text-white text-lg px-6 py-3');
    });
  });
}); 