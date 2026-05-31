import commonEnglishWordsRaw from 'word-list-google/google-10000-english.txt?raw';

const COMMON_ENGLISH_WORDS = new Set(
  commonEnglishWordsRaw
    .split(/\r?\n/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)
);

export const isCommonEnglishWord = (word: string): boolean =>
  COMMON_ENGLISH_WORDS.has(word.trim().toLowerCase());
