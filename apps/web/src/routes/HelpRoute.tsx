import {useEffect, useId, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router';
import {PageHeader} from '../components/PageHeader';
import {HELP_TOPICS, type HelpBlock, type HelpTopic} from '../help/helpTopics';
import {filterHelpTopics, parseHelpText} from '../help/helpSearch';
import {PORTABLE_SCHEMA_README} from '../services/portability/portableData';
import styles from '../styles/HelpRoute.module.css';

/** Shows `**Label**` parts in bold. */
function HelpText({text}: {text: string}) {
  return (
    <>
      {parseHelpText(text).map((part, index) =>
        part.label ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>
      )}
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

function HelpTopicSection({topic}: {topic: HelpTopic}) {
  return (
    <section className={styles.topic} aria-labelledby={topicElementId(topic.id)}>
      <h2 id={topicElementId(topic.id)} tabIndex={-1} className={styles.topicTitle}>
        {topic.title}
      </h2>
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
    </section>
  );
}

/** Author help (Slice 5.8): offline, in-app, one page of short topics. */
function HelpRoute() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const topics = useMemo(() => filterHelpTopics(HELP_TOPICS, query), [query]);
  const requestedTopic = searchParams.get('topic');

  // `/help?topic=privacy` opens at that topic, so other screens can link to it.
  useEffect(() => {
    if (requestedTopic) showTopic(requestedTopic);
  }, [requestedTopic]);

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
          onChange={(event) => setQuery(event.target.value)}
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
                  <button type='button' className={styles.topicButton} onClick={() => showTopic(topic.id)}>
                    <span className={styles.topicButtonTitle}>{topic.title}</span>
                    <span className={styles.topicButtonSummary}>{topic.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {topics.map((topic) => (
            <HelpTopicSection key={topic.id} topic={topic} />
          ))}
        </>
      )}

      <details className={styles.format}>
        <summary>Portable export format</summary>
        <p>
          Every <strong>Export Markdown + CSV</strong> ZIP includes this description of its files as{' '}
          <code>README.md</code>, so other tools and people can read it without SagaSpine.
        </p>
        <pre className={styles.formatText}>{PORTABLE_SCHEMA_README}</pre>
      </details>
    </section>
  );
}

export default HelpRoute;
