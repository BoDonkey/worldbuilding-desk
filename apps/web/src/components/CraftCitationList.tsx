import type {CraftCitation} from '../services/craft/types';

interface CraftCitationListProps {
  citations: CraftCitation[];
}

export function CraftCitationList({citations}: CraftCitationListProps) {
  if (citations.length === 0) return null;
  return (
    <ul aria-label='Craft references'>
      {citations.map((citation) => (
        <li key={citation.id}>
          {citation.url ? (
            <a href={citation.url} target='_blank' rel='noreferrer'>
              {citation.label}
            </a>
          ) : citation.label}
        </li>
      ))}
    </ul>
  );
}
