import type {ModelContextSize} from '../../services/llm/modelContextSize';

export interface LeftOutItem {
  source: string;
  detail: string;
}

/**
 * Lists the context the budget left out (Slice 4.71), so the author knows
 * what the model was not given. Shows nothing when everything fit.
 */
export function ContextLeftOutNotice({
  omitted,
  budgetTokens,
  size,
  className
}: {
  omitted: LeftOutItem[];
  budgetTokens: number;
  size: ModelContextSize | null;
  className?: string;
}) {
  if (omitted.length === 0) return null;
  const sizeNote = size
    ? size.source === 'assumed'
      ? ` The model’s context size was not reported, so ${size.tokens.toLocaleString()} tokens is assumed.`
      : ` The model takes ${size.tokens.toLocaleString()} tokens.`
    : '';
  // One entry per source; single facts are listed under their section.
  const groups = new Map<string, string[]>();
  omitted.forEach((item) => {
    const details = groups.get(item.source) ?? [];
    if (item.detail) details.push(item.detail);
    groups.set(item.source, details);
  });
  return (
    <div className={className} aria-label='Left out of the model’s context'>
      <p>
        Left out to fit the model’s context ({omitted.length} {omitted.length === 1 ? 'item' : 'items'}; about{' '}
        {budgetTokens.toLocaleString()} tokens were available for project context).{sizeNote}
      </p>
      <details>
        <summary>Show what was left out</summary>
        <ul>
          {[...groups].map(([source, details]) => (
            <li key={source}>
              {source}
              {details.length > 0 && (
                <ul>
                  {details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
