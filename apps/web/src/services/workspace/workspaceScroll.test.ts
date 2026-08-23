import {describe, expect, it} from 'vitest';
import {getWorkspaceSceneScrollKey} from './workspaceScroll';

describe('getWorkspaceSceneScrollKey', () => {
  it('includes both project and scene identity for every scroll scope', () => {
    expect(
      getWorkspaceSceneScrollKey('workspace-editor-scroll', 'project-a', 'scene-a')
    ).toBe('workspace-editor-scroll:project-a:scene-a');
    expect(
      getWorkspaceSceneScrollKey('workspace-scroll', 'project-a', 'scene-a')
    ).toBe('workspace-scroll:project-a:scene-a');
    expect(
      getWorkspaceSceneScrollKey(
        'wbd:workspace-window-scroll',
        'project-a',
        'scene-a'
      )
    ).toBe('wbd:workspace-window-scroll:project-a:scene-a');
  });

  it('cannot collide across projects or scenes', () => {
    const base = getWorkspaceSceneScrollKey(
      'workspace-editor-scroll',
      'project-a',
      'scene-a'
    );
    expect(
      getWorkspaceSceneScrollKey('workspace-editor-scroll', 'project-b', 'scene-a')
    ).not.toBe(base);
    expect(
      getWorkspaceSceneScrollKey('workspace-editor-scroll', 'project-a', 'scene-b')
    ).not.toBe(base);
  });
});
