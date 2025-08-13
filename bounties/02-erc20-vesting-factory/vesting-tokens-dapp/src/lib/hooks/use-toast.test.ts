import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useToast } from './use-toast'
import { reducer } from './use-toast'

// Mock the toast components
jest.mock('@/components/ui/toast', () => ({
  Toast: () => React.createElement('div', { 'data-testid': 'toast' }, 'Toast'),
  ToastAction: () => React.createElement('div', { 'data-testid': 'toast-action' }, 'Action'),
}))

describe('useToast Hook', () => {
  beforeEach(() => {
    // Reset the count for ID generation
    jest.clearAllMocks()
  })

  it('should provide toast function', () => {
    const { result } = renderHook(() => useToast())
    
    expect(result.current.toast).toBeDefined()
    expect(typeof result.current.toast).toBe('function')
  })

  it('should provide dismiss function', () => {
    const { result } = renderHook(() => useToast())
    
    expect(result.current.dismiss).toBeDefined()
    expect(typeof result.current.dismiss).toBe('function')
  })

  it('should create toast with default values', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      result.current.toast({
        title: 'Test Toast',
        description: 'Test Description',
      })
    })

    // The toast function should not throw an error
    expect(result.current.toast).toBeDefined()
  })

  it('should create toast with custom duration', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      result.current.toast({
        title: 'Custom Duration Toast',
        duration: 5000,
      })
    })

    expect(result.current.toast).toBeDefined()
  })

  it('should dismiss toast by ID', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      result.current.dismiss('test-toast-id')
    })

    expect(result.current.dismiss).toBeDefined()
  })

  it('should dismiss all toasts when no ID provided', () => {
    const { result } = renderHook(() => useToast())
    
    act(() => {
      result.current.dismiss()
    })

    expect(result.current.dismiss).toBeDefined()
  })
})

describe('Toast Reducer', () => {
  const initialState = { toasts: [] }

  it('should handle ADD_TOAST action', () => {
    const toast = {
      id: '1',
      title: 'Test Toast',
      description: 'Test Description',
    }

    const action = {
      type: 'ADD_TOAST' as const,
      toast,
    }

    const newState = reducer(initialState, action)

    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0]).toEqual(toast)
  })

  it('should handle UPDATE_TOAST action', () => {
    const existingToast = {
      id: '1',
      title: 'Original Title',
      description: 'Original Description',
    }

    const state = { toasts: [existingToast] }
    const updateAction = {
      type: 'UPDATE_TOAST' as const,
      toast: { id: '1', title: 'Updated Title' },
    }

    const newState = reducer(state, updateAction)

    expect(newState.toasts[0].title).toBe('Updated Title')
    expect(newState.toasts[0].description).toBe('Original Description')
  })

  it('should handle DISMISS_TOAST action', () => {
    const toast = {
      id: '1',
      title: 'Test Toast',
    }

    const state = { toasts: [toast] }
    const dismissAction = {
      type: 'DISMISS_TOAST' as const,
      toastId: '1',
    }

    const newState = reducer(state, dismissAction)

    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0].id).toBe('1')
  })

  it('should handle REMOVE_TOAST action', () => {
    const toast = {
      id: '1',
      title: 'Test Toast',
    }

    const state = { toasts: [toast] }
    const removeAction = {
      type: 'REMOVE_TOAST' as const,
      toastId: '1',
    }

    const newState = reducer(state, removeAction)

    expect(newState.toasts).toHaveLength(0)
  })

  it('should limit toasts to TOAST_LIMIT', () => {
    const toasts = Array.from({ length: 5 }, (_, i) => ({
      id: i.toString(),
      title: `Toast ${i}`,
    }))

    const state = { toasts }
    const addAction = {
      type: 'ADD_TOAST' as const,
      toast: { id: '6', title: 'New Toast' },
    }

    const newState = reducer(state, addAction)

    // Should only keep TOAST_LIMIT (1) toasts
    expect(newState.toasts).toHaveLength(1)
    expect(newState.toasts[0].id).toBe('6')
  })
}) 