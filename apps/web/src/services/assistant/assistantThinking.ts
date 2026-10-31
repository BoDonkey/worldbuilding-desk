/** Removes model reasoning and hidden system text from a reply before it is shown, saved, or resent. */
export const stripAssistantThinking = (content: string): string =>
  content
    .replace(
      /\*?SILENT SYSTEM MESSAGE\*?[\s\S]*?\*?END SYSTEM MESSAGE\*?/gi,
      ''
    )
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .trimStart();
