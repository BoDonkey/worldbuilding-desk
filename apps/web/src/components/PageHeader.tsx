import type {ReactNode} from 'react';
import styles from '../assets/components/PageHeader.module.css';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {meta ? <p className={styles.meta}>{meta}</p> : null}
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
