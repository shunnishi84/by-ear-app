import { useCallback, useReducer } from 'react';

interface H<T> {
  past: T[];
  present: T;
  future: T[];
}
type A<T> = { type: 'commit'; next: T } | { type: 'undo' } | { type: 'redo' } | { type: 'reset'; next: T };

const LIMIT = 200;

function reducer<T>(s: H<T>, a: A<T>): H<T> {
  switch (a.type) {
    case 'commit':
      if (a.next === s.present) return s;
      return { past: [...s.past, s.present].slice(-LIMIT), present: a.next, future: [] };
    case 'undo':
      if (!s.past.length) return s;
      return { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] };
    case 'redo':
      if (!s.future.length) return s;
      return { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) };
    case 'reset':
      return { past: [], present: a.next, future: [] };
  }
}

export function useHistory<T>(init: () => T) {
  const [s, dispatch] = useReducer(reducer<T>, undefined, () => ({ past: [], present: init(), future: [] }));
  return {
    value: s.present,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0,
    commit: useCallback((next: T) => dispatch({ type: 'commit', next }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    reset: useCallback((next: T) => dispatch({ type: 'reset', next }), []),
  };
}
