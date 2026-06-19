import {useCallback, useEffect, useMemo, useRef, useState, type FC} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import {useCommandPalette} from '../contexts/commandPaletteApi';
import {getCompendiumEntriesByProject} from '../services/compendium';
import {getProjectCapabilities} from '../projectMode';
import {useAppStore} from '../store/appStore';
import styles from '../assets/components/Navigation.module.css';

interface NavigationProps {
  isRailCollapsed?: boolean;
  onToggleRail?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badgeCount?: number;
}

interface WorkspaceScrollSnapshot {
  elements: Array<{key: string; top: number; left: number}>;
  windowY: number;
}

declare global {
  interface Window {
    __wbdLastWorkspaceScrollSnapshot?: WorkspaceScrollSnapshot;
  }
}

export const Navigation: FC<NavigationProps> = ({
  isRailCollapsed = false,
  onToggleRail
}) => {
  const {openPalette} = useCommandPalette();
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const location = useLocation();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSecondaryMenuOpen, setSecondaryMenuOpen] = useState(false);
  const [compendiumPendingCount, setCompendiumPendingCount] = useState(0);
  const mobileMenuCloseRef = useRef<HTMLButtonElement | null>(null);
  const capabilities = getProjectCapabilities(activeProject ? projectSettings : null);
  const loadPendingCounts = useCallback(() => {
    if (!activeProject || !capabilities.canUseGameSystems) {
      setCompendiumPendingCount(0);
      return Promise.resolve();
    }

    return getCompendiumEntriesByProject(activeProject.id)
      .then((entries) => {
        setCompendiumPendingCount(entries.filter((entry) => entry.needsCompletion).length);
      })
      .catch(() => {
        setCompendiumPendingCount(0);
      });
  }, [activeProject, capabilities.canUseGameSystems]);

  useEffect(() => {
    let cancelled = false;
    void loadPendingCounts().then(() => {
      if (cancelled) return;
    });

    const handleRecordsChanged = () => {
      void loadPendingCounts();
    };
    window.addEventListener('wbd:compendium-records-changed', handleRecordsChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('wbd:compendium-records-changed', handleRecordsChanged);
    };
  }, [loadPendingCounts, location.pathname]);

  const primaryNavItems = useMemo<NavItem[]>(
    () => [
      {to: '/projects', label: 'Projects', icon: 'PR'},
      {to: '/workspace', label: 'Workspace', icon: 'WS'},
      {to: '/world-bible', label: 'World Bible', icon: 'WB'},
      {to: '/lore', label: 'Lore Docs', icon: 'LD'}
    ],
    []
  );

  const secondaryNavItems = useMemo<NavItem[]>(
    () => [
      {to: '/canon-decisions', label: 'Canon Review', icon: 'CR'},
      {to: '/corkboard', label: 'Corkboard', icon: 'CB'},
      ...(capabilities.canUseRuleAuthoring
        ? [{to: '/ruleset', label: 'Ruleset', icon: 'RS'}]
        : []),
      ...(capabilities.canUseGameSystems
        ? [{to: '/compendium', label: 'Compendium', icon: 'CP', badgeCount: compendiumPendingCount}]
        : []),
      {to: '/settings', label: 'Settings', icon: 'ST'}
    ],
    [
      capabilities.canUseGameSystems,
      capabilities.canUseRuleAuthoring,
      compendiumPendingCount
    ]
  );

  const navItems = useMemo<NavItem[]>(
    () => [...primaryNavItems, ...secondaryNavItems],
    [primaryNavItems, secondaryNavItems]
  );

  const secondaryBadgeCount = useMemo(
    () => secondaryNavItems.reduce((total, item) => total + (item.badgeCount ?? 0), 0),
    [secondaryNavItems]
  );

  const isSecondaryRouteActive = secondaryNavItems.some((item) => location.pathname === item.to);

  const mobileBarItems = useMemo(
    () => primaryNavItems,
    [primaryNavItems]
  );
  useEffect(() => {
    setMobileMenuOpen(false);
    setSecondaryMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen && !isSecondaryMenuOpen) return;
    mobileMenuCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setSecondaryMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen, isSecondaryMenuOpen]);

  const captureRouteScroll = useCallback(() => {
    if (location.pathname === '/workspace') {
      window.__wbdLastWorkspaceScrollSnapshot = {
        windowY: window.scrollY,
        elements: Array.from(
          document.querySelectorAll<HTMLElement>('[data-wbd-scroll-key]')
        )
          .map((element) => ({
            key: element.dataset.wbdScrollKey ?? '',
            top: element.scrollTop,
            left: element.scrollLeft
          }))
          .filter((entry) => entry.key)
      };
    }
    window.dispatchEvent(new CustomEvent('wbd:capture-workspace-scroll'));
  }, [location.pathname]);

  return (
    <>
      {!isRailCollapsed && (
        <aside className={styles.rail}>
          <div className={styles.brand} title='Worldbuilding Desk'>
            WBD
          </div>
          <button
            type='button'
            className={styles.searchLauncher}
            onClick={openPalette}
            title='Search scenes and canon records'
          >
            <span className={styles.icon}>SR</span>
            <span className={styles.label}>Search</span>
          </button>
          <nav className={styles.railLinks} aria-label='Primary navigation'>
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                onMouseDownCapture={captureRouteScroll}
                onClickCapture={captureRouteScroll}
                className={({isActive}) => `${styles.railLink} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {item.badgeCount ? (
                  <span className={styles.navBadge}>{item.badgeCount}</span>
                ) : null}
              </NavLink>
            ))}
            <div className={styles.moreWrapper}>
              <button
                type='button'
                className={`${styles.railLink} ${styles.moreButton} ${
                  isSecondaryRouteActive ? styles.active : ''
                }`}
                onClick={() => setSecondaryMenuOpen((prev) => !prev)}
                aria-expanded={isSecondaryMenuOpen}
                aria-haspopup='menu'
                title='More destinations'
              >
                <span className={styles.icon}>MO</span>
                <span className={styles.label}>More</span>
                {secondaryBadgeCount ? (
                  <span className={styles.navBadge}>{secondaryBadgeCount}</span>
                ) : null}
              </button>
              {isSecondaryMenuOpen ? (
                <div className={styles.secondaryMenu} role='menu'>
                  <div className={styles.secondaryMenuLabel}>More</div>
                  {secondaryNavItems.map((item) => (
                    <NavLink
                      key={`secondary-${item.to}`}
                      to={item.to}
                      end={item.end}
                      title={item.label}
                      onMouseDownCapture={captureRouteScroll}
                      onClickCapture={captureRouteScroll}
                      className={({isActive}) =>
                        `${styles.secondaryMenuLink} ${isActive ? styles.active : ''}`
                      }
                      role='menuitem'
                    >
                      <span className={styles.secondaryMenuIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                      {item.badgeCount ? (
                        <span className={styles.mobileMenuBadge}>{item.badgeCount}</span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
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
            onMouseDownCapture={captureRouteScroll}
            onClickCapture={captureRouteScroll}
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
              <button
                type='button'
                className={styles.mobileMenuAction}
                onClick={() => {
                  setMobileMenuOpen(false);
                  openPalette();
                }}
              >
                <span>Search scenes and canon records</span>
                <span className={styles.mobileMenuActionMeta}>Cmd/Ctrl+K</span>
              </button>
              {navItems.map((item) => (
                <NavLink
                  key={`mobile-${item.to}`}
                  to={item.to}
                  end={item.end}
                  onMouseDownCapture={captureRouteScroll}
                  onClickCapture={captureRouteScroll}
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
