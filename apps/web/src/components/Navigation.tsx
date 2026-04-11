import {useCallback, useEffect, useMemo, useRef, useState, type FC} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import {getEntitiesByProject} from '../entityStorage';
import {getCompendiumEntriesByProject} from '../services/compendium';
import {useAppStore} from '../store/appStore';
import styles from '../assets/components/Navigation.module.css';

interface NavigationProps {
  isRailCollapsed?: boolean;
  onToggleRail?: () => void;
}

export const Navigation: FC<NavigationProps> = ({
  isRailCollapsed = false,
  onToggleRail
}) => {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const location = useLocation();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<{world: number; compendium: number}>({
    world: 0,
    compendium: 0
  });
  const mobileMenuCloseRef = useRef<HTMLButtonElement | null>(null);
  const showGameSystems =
    !activeProject || projectSettings?.featureToggles.enableGameSystems !== false;
  const loadPendingCounts = useCallback(() => {
    if (!activeProject) {
      setPendingCounts({world: 0, compendium: 0});
      return Promise.resolve();
    }

    return Promise.all([
      getEntitiesByProject(activeProject.id),
      getCompendiumEntriesByProject(activeProject.id)
    ])
      .then(([entities, entries]) => {
        setPendingCounts({
          world: entities.filter((entity) => entity.needsCompletion).length,
          compendium: entries.filter((entry) => entry.needsCompletion).length
        });
      })
      .catch(() => {
        setPendingCounts({world: 0, compendium: 0});
      });
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    void loadPendingCounts().then(() => {
      if (cancelled) return;
    });

    const handleRecordsChanged = () => {
      void loadPendingCounts();
    };
    window.addEventListener('wbd:entity-records-changed', handleRecordsChanged);
    window.addEventListener('wbd:compendium-records-changed', handleRecordsChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('wbd:entity-records-changed', handleRecordsChanged);
      window.removeEventListener('wbd:compendium-records-changed', handleRecordsChanged);
    };
  }, [loadPendingCounts, location.pathname]);

  const navItems = useMemo(
    () => [
      {to: '/', label: 'Projects', icon: 'PR', end: true},
      {to: '/world-bible', label: 'World', icon: 'WB', badgeCount: pendingCounts.world},
      {to: '/ruleset', label: 'Ruleset', icon: 'RS'},
      {to: '/characters', label: 'Characters', icon: 'CH'},
      {to: '/workspace', label: 'Workspace', icon: 'WS'},
      ...(showGameSystems
        ? [{to: '/compendium', label: 'Compendium', icon: 'CP', badgeCount: pendingCounts.compendium}]
        : []),
      {to: '/settings', label: 'Settings', icon: 'ST'}
    ],
    [pendingCounts.compendium, pendingCounts.world, showGameSystems]
  );

  const mobileBarItems = useMemo(
    () => navItems.filter((item) => ['/', '/world-bible', '/workspace', '/characters'].includes(item.to)),
    [navItems]
  );
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    mobileMenuCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <>
      {!isRailCollapsed && (
        <aside className={styles.rail}>
          <div className={styles.brand} title='Worldbuilding Desk'>
            WBD
          </div>
          <nav className={styles.railLinks} aria-label='Primary navigation'>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={({isActive}) => `${styles.railLink} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {item.badgeCount ? (
                  <span className={styles.navBadge}>{item.badgeCount}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className={styles.railFooter}>
            <button
              type='button'
              className={styles.railToggle}
              onClick={onToggleRail}
              aria-label='Hide side rail'
              title='Hide side rail'
            >
              «
            </button>
            <span className={styles.shortcutHint}>Cmd/Ctrl+K</span>
            <div className={styles.projectInfo}>
              {activeProject ? (
                <span>
                  <strong>{activeProject.name}</strong>
                </span>
              ) : (
                <span>No project</span>
              )}
            </div>
            <ThemeToggle />
          </div>
        </aside>
      )}

      {isRailCollapsed && (
        <button
          type='button'
          className={styles.floatingRailToggle}
          onClick={onToggleRail}
          aria-label='Show side rail'
          title='Show side rail'
        >
          »
        </button>
      )}

      <nav className={styles.mobileBar} aria-label='Mobile navigation'>
        {mobileBarItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({isActive}) => `${styles.mobileItem} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.mobileLabel}>{item.label}</span>
            {item.badgeCount ? <span className={styles.navBadge}>{item.badgeCount}</span> : null}
          </NavLink>
        ))}
        <button
          type='button'
          className={styles.mobileItem}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={isMobileMenuOpen}
          aria-label='Toggle more navigation options'
        >
          <span className={styles.icon}>MO</span>
          <span className={styles.mobileLabel}>More</span>
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className={styles.mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)}>
          <div
            className={styles.mobileMenu}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={styles.mobileMenuTitle}>Navigation</h2>
            <div className={styles.mobileMenuLinks}>
              {navItems.map((item) => (
                <NavLink
                  key={`mobile-${item.to}`}
                  to={item.to}
                  end={item.end}
                  className={({isActive}) =>
                    `${styles.mobileMenuLink} ${isActive ? styles.active : ''}`
                  }
                >
                  {item.label}
                  {item.badgeCount ? (
                    <span className={styles.mobileMenuBadge}>{item.badgeCount}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
            <div className={styles.mobileMenuMeta}>
              <span className={styles.shortcutHint}>Cmd/Ctrl+K</span>
              <button
                ref={mobileMenuCloseRef}
                type='button'
                className={styles.mobileMenuClose}
                onClick={() => setMobileMenuOpen(false)}
              >
                Close Menu
              </button>
              <div className={styles.projectInfo}>
                {activeProject ? (
                  <span>
                    Active: <strong>{activeProject.name}</strong>
                  </span>
                ) : (
                  <span>No active project</span>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
