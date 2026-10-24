// Seguro para componentes 'use client': só funções puras, nada de Node.
export * from './types.ts';
export { searchTranscript, selectionToTrim, expandToSentence, trimToText, wordsForClip, wordIndexAt, lineIndexAt, windowTranscript } from './selection.ts';
export type { Trim, TrimOptions, SearchHit } from './selection.ts';
export { toSrt } from './normalize.ts';
export type { Highlight } from './highlights.ts';
