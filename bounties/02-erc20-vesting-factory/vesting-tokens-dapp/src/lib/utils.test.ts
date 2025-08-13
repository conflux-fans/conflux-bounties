import { cn } from './utils'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('class1', 'class2', 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should handle conditional classes', () => {
    const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
    expect(result).toBe('base-class conditional-class')
  })

  it('should handle undefined and null values', () => {
    const result = cn('base-class', undefined, null, 'valid-class')
    expect(result).toBe('base-class valid-class')
  })

  it('should handle empty strings', () => {
    const result = cn('base-class', '', 'valid-class')
    expect(result).toBe('base-class valid-class')
  })

  it('should handle complex conditional logic', () => {
    const isActive = true
    const isDisabled = false
    const result = cn(
      'button',
      isActive && 'active',
      isDisabled && 'disabled',
      'primary'
    )
    expect(result).toBe('button active primary')
  })

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3', ['class4', 'class5'])
    expect(result).toBe('class1 class2 class3 class4 class5')
  })

  it('should handle objects with boolean values', () => {
    const result = cn('base', { 'class-a': true, 'class-b': false, 'class-c': true })
    expect(result).toBe('base class-a class-c')
  })
}) 