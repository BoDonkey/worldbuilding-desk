/**
 * A short, stable hash of text (djb2, as `h` + hex). Scene changes store it
 * as `sourceHash` and staleness checks compare against it, so every writer
 * and reader must use this one function (slice 3.52).
 */
export const hashString = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};
