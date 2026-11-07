import {useCallback, useEffect, useId, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router';
import {PageHeader} from '../components/PageHeader';
import {HELP_TOPICS, type HelpBlock, type HelpTopic} from '../help/helpTopics';
import {filterHelpTopics, parseHelpText} from '../help/helpSearch';
import styles from '../styles/HelpRoute.module.css';

/** Shows `**Label**` parts in bold and `` `code` `` parts as code. */
function HelpText({text}: {text: string}) {
  return (
    <>
      {parseHelpText(text).map((part, index) => {
        if (part.code) return <code key={index}>{part.text}</code>;
        return part.label ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

function HelpBlockView({block}: {block: HelpBlock}) {
  if (block.kind === 'paragraph') {
    return (
      <p>
        <HelpText text={block.text} />
      </p>
    );
  }
  const items = block.items.map((item) => (
    <li key={item}>
      <HelpText text={item} />
    </li>
  ));
  return block.kind === 'steps' ? <ol>{items}</ol> : <ul>{items}</ul>;
}

function topicElementId(topicId: string): string {
  return `help-${topicId}`;
}

/** Moves to a topic without touching the URL hash, which the desktop router owns. */
function showTopic(topicId: string) {
  const heading = document.getElementById(topicElementId(topicId));
  if (!heading) return;
  heading.scrollIntoView?.({block: 'start'});
  heading.focus({preventScroll: true});
}

interface HelpTopicSectionProps {
  topic: HelpTopic;
  open: boolean;
  onToggle: (topicId: string, open: boolean) => void;
}

function HelpTopicSection({topic, open, onToggle}: HelpTopicSectionProps) {
  return (
    <details
      className={styles.topic}
      open={open}
      onToggle={(event) => onToggle(topic.id, event.currentTarget.open)}
    >
      <summary className={styles.topicSummary}>
        <h2 id={topicElementId(topic.id)} tabIndex={-1} className={styles.topicTitle}>
          {topic.title}
        </h2>
      </summary>
      <div className={styles.topicBody}>
        {topic.blocks.map((block, index) => (
          <HelpBlockView key={index} block={block} />
        ))}
      </div>
      {topic.links.length > 0 && (
        <nav className={styles.topicLinks} aria-label={`Screens for ${topic.title}`}>
          {topic.links.map((link) => (
            <Link key={link.to} to={link.to} className={styles.topicLink}>
              Open {link.label}
            </Link>
          ))}
        </nav>
      )}
    </details>
  );
}

function matchingTopicIds(query: string): Set<string> {
  if (!query.trim()) return new Set();
  return new Set(filterHelpTopics(HELP_TOPICS, query).map((topic) => topic.id));
}

/** Author help (Slice 5.8): offline, in-app, one page of short topics. */
function HelpRoute() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const topics = useMemo(() => filterHelpTopics(HELP_TOPICS, query), [query]);
  const requestedTopic = searchParams.get('topic');
  // Topics start collapsed so the page reads as an index; search opens matches.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(requestedTopic ? [requestedTopic] : [])
  );
  // A topic to scroll to and focus once it has rendered open.
  const [focusTarget, setFocusTarget] = useState<string | null>(requestedTopic);

  const openTopic = useCallback((topicId: string) => {
    setOpenIds((current) => (current.has(topicId) ? current : new Set(current).add(topicId)));
    setFocusTarget(topicId);
  }, []);

  const toggleTopic = useCallback((topicId: string, open: boolean) => {
    setOpenIds((current) => {
      if (current.has(topicId) === open) return current;
      const next = new Set(current);
      if (open) next.add(topicId);
      else next.delete(topicId);
      return next;
    });
  }, []);

  // `/help?topic=privacy` opens at that topic, so other screens can link to it.
  useEffect(() => {
    if (requestedTopic) openTopic(requestedTopic);
  }, [requestedTopic, openTopic]);

  useEffect(() => {
    if (!focusTarget) return;
    showTopic(focusTarget);
    setFocusTarget(null);
  }, [focusTarget]);

  const allOpen = topics.length > 0 && topics.every((topic) => openIds.has(topic.id));

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='SagaSpine'
        title='Help'
        description='Short guides to how SagaSpine works, what counts as canon, and where your data goes. Help works offline.'
      />

      <div className={styles.search}>
        <label htmlFor={searchId}>Search help</label>
        <input
          id={searchId}
          type='search'
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpenIds(matchingTopicIds(event.target.value));
          }}
          placeholder='Try backup, import, canon, or Ollama'
        />
      </div>

      {topics.length === 0 ? (
        <p className={styles.empty} role='status'>
          No help topic matches “{query}”. Try a shorter word.
        </p>
      ) : (
        <>
          <nav aria-label='Help topics'>
            <ul className={styles.topicList}>
              {topics.map((topic) => (
                <li key={topic.id}>
                  <button type='button' className={styles.topicButton} onClick={() => openTopic(topic.id)}>
                    <span className={styles.topicButtonTitle}>{topic.title}</span>
                    <span className={styles.topicButtonSummary}>{topic.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.expandRow}>
            <button
              type='button'
              className={styles.expandButton}
              onClick={() => setOpenIds(allOpen ? new Set() : new Set(topics.map((topic) => topic.id)))}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          {topics.map((topic) => (
            <HelpTopicSection
              key={topic.id}
              topic={topic}
              open={openIds.has(topic.id)}
              onToggle={toggleTopic}
            />
          ))}
        </>
      )}

    </section>
  );
}

export default HelpRoute;
