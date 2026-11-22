import {useEffect, useRef, useState} from 'react';
import type {AnyExtension} from '@tiptap/core';
import {EditorContent, useEditor} from '@tiptap/react';
import type {PassageRewriteSession} from '../../hooks/usePassageRewrite';
import type {usePassageRewrite} from '../../hooks/usePassageRewrite';
import styles from './PassageRewritePanel.module.css';

type PassageRewriteController = ReturnType<typeof usePassageRewrite>;

/**
 * Rewrite beside the original (slice 4.97): the passage read-only beside an
 * editable copy. Use rewrite, Keep both (saves an alternative in Snapshots),
 * or Discard. Give it a `key` per session.
 */
export function PassageRewritePanel({session, controller, extensions}: {
  session: PassageRewriteSession;
  controller: PassageRewriteController;
  /** The scene editor's schema, so the copy keeps its formatting. */
  extensions: AnyExtension[];
}) {
  const region = useRef<HTMLElement>(null);
  const staleAlert = useRef<HTMLParagraphElement>(null);
  const [name, setName] = useState(session.alternativeName ?? '');
  const original = useEditor({extensions, content: session.originalHtml, editable: false, immediatelyRender: true});
  const rewrite = useEditor({
    extensions,
    content: session.rewriteHtml,
    immediatelyRender: true,
    editorProps: {attributes: {'aria-label': 'Rewrite', role: 'textbox', 'aria-multiline': 'true'}}
  });
  useEffect(() => {
    region.current?.scrollIntoView({block: 'nearest'});
    rewrite?.commands.focus('end');
  }, [rewrite]);
  useEffect(() => {
    if (controller.isStale) staleAlert.current?.scrollIntoView({block: 'nearest'});
  }, [controller.isStale]);

  return (
    <section ref={region} className={styles.panel} aria-label='Rewrite beside the original' tabIndex={-1}>
      <h3 className={styles.heading}>Rewrite beside the original</h3>
      <p className={styles.note}>
        Edit the copy on the right; the scene is unchanged until you choose Use rewrite, and Undo brings the
        original back. Keep both saves the rewrite in this scene&apos;s Snapshots to come back to.
      </p>
      {controller.isStale && (
        <p ref={staleAlert} role='alert' className={styles.stale}>
          The original passage changed while this rewrite was open, so Use rewrite would replace different text.
          Keep both to save your rewrite, or Discard and select the passage again.
        </p>
      )}
      <div className={styles.panes}>
        <div className={styles.pane}>
          <h4 className={styles.paneHeading}>Original</h4>
          <div className={`${styles.text} ${styles.original}`} data-testid='rewrite-original'>
            <EditorContent editor={original} />
          </div>
        </div>
        <div className={styles.pane}>
          <h4 className={styles.paneHeading}>Rewrite</h4>
          <div className={`${styles.text} ${styles.rewrite}`} data-testid='rewrite-copy'>
            <EditorContent editor={rewrite} />
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <button
          type='button'
          disabled={controller.isStale || !rewrite}
          onClick={() => rewrite && controller.applyRewrite(rewrite.getJSON())}
        >
          Use rewrite
        </button>
        <label className={styles.nameLabel}>
          Alternative name (optional)
          <input type='text' value={name} placeholder='Colder opening' onChange={(event) => setName(event.target.value)} />
        </label>
        <button
          type='button'
          disabled={controller.isWorking || !rewrite}
          onClick={() => rewrite && void controller.keepBoth(rewrite.getHTML(), name)}
        >
          Keep both
        </button>
        <button type='button' onClick={controller.discard}>Discard</button>
      </div>
    </section>
  );
}
