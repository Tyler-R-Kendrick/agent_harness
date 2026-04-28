import { describe, expect, it } from 'vitest';
import { summarizeToolCall } from './toolCallSummary';

describe('summarizeToolCall', () => {
  describe('existing tools', () => {
    it('summarizes cli commands', () => {
      expect(summarizeToolCall('cli', { command: 'ls -la' })).toBe('$ ls -la');
    });

    it('summarizes read_file', () => {
      expect(summarizeToolCall('read_file', { filePath: '/foo/bar.ts', startLine: 1, endLine: 10 })).toBe(
        'Read bar.ts, lines 1 to 10',
      );
    });
  });

  describe('webmcp: filesystem tools', () => {
    it('lists filesystem entries by default', () => {
      expect(summarizeToolCall('webmcp:list_filesystem_entries', {})).toBe('Listed filesystem entries');
    });

    it('shows search query when listing with query', () => {
      expect(summarizeToolCall('webmcp:list_filesystem_entries', { query: 'AGENTS.md' })).toBe('Searched for "AGENTS.md"');
    });

    it('shows parent path when listing without query', () => {
      expect(summarizeToolCall('webmcp:list_filesystem_entries', { parentPath: '/src' })).toBe('Listed entries in /src');
    });

    it('reads filesystem properties with path', () => {
      expect(summarizeToolCall('webmcp:read_filesystem_properties', { path: '/foo/bar.ts' })).toBe(
        'Read properties of bar.ts',
      );
    });

    it('reads filesystem properties without path', () => {
      expect(summarizeToolCall('webmcp:read_filesystem_properties', {})).toBe('Read file properties');
    });

    it('reads filesystem history', () => {
      expect(summarizeToolCall('webmcp:read_filesystem_history', {})).toBe('Read file history');
    });

    it('rolls back filesystem history', () => {
      expect(summarizeToolCall('webmcp:rollback_filesystem_history', {})).toBe('Rolled back file history');
    });

    it('changes filesystem mount', () => {
      expect(summarizeToolCall('webmcp:change_filesystem_mount', {})).toBe('Changed filesystem mount');
    });

    it('adds a filesystem entry with path', () => {
      expect(summarizeToolCall('webmcp:add_filesystem_entry', { path: '/foo/note.md' })).toBe('Added note.md');
    });

    it('updates a filesystem entry with path', () => {
      expect(summarizeToolCall('webmcp:update_filesystem_entry', { path: '/foo/note.md' })).toBe('Updated note.md');
    });

    it('removes a filesystem entry with path', () => {
      expect(summarizeToolCall('webmcp:remove_filesystem_entry', { path: '/foo/note.md' })).toBe('Removed note.md');
    });
  });

  describe('webmcp: clipboard tools', () => {
    it('lists clipboard history', () => {
      expect(summarizeToolCall('webmcp:list_clipboard_history', {})).toBe('Listed clipboard history');
    });

    it('reads clipboard entry', () => {
      expect(summarizeToolCall('webmcp:read_clipboard_entry', {})).toBe('Read clipboard entry');
    });

    it('restores clipboard entry', () => {
      expect(summarizeToolCall('webmcp:restore_clipboard_entry', {})).toBe('Restored clipboard entry');
    });
  });

  describe('webmcp: browser page tools', () => {
    it('lists browser pages', () => {
      expect(summarizeToolCall('webmcp:list_browser_pages', {})).toBe('Listed browser pages');
    });

    it('reads browser page', () => {
      expect(summarizeToolCall('webmcp:read_browser_page', {})).toBe('Read browser page');
    });

    it('reads browser page history', () => {
      expect(summarizeToolCall('webmcp:read_browser_page_history', {})).toBe('Read page history');
    });

    it('creates a browser page', () => {
      expect(summarizeToolCall('webmcp:create_browser_page', { url: 'https://example.com' })).toBe(
        'Created browser page',
      );
    });

    it('navigates browser page to url', () => {
      expect(summarizeToolCall('webmcp:navigate_browser_page', { url: 'https://example.com' })).toBe(
        'Navigated to https://example.com',
      );
    });

    it('navigates browser page without url', () => {
      expect(summarizeToolCall('webmcp:navigate_browser_page', {})).toBe('Navigated browser page');
    });

    it('navigates browser page history', () => {
      expect(summarizeToolCall('webmcp:navigate_browser_page_history', {})).toBe('Navigated page history');
    });

    it('refreshes browser page', () => {
      expect(summarizeToolCall('webmcp:refresh_browser_page', {})).toBe('Refreshed browser page');
    });
  });

  describe('webmcp: render pane tools', () => {
    it('lists render panes', () => {
      expect(summarizeToolCall('webmcp:list_render_panes', {})).toBe('Listed render panes');
    });

    it('closes render pane', () => {
      expect(summarizeToolCall('webmcp:close_render_pane', {})).toBe('Closed render pane');
    });

    it('moves render pane', () => {
      expect(summarizeToolCall('webmcp:move_render_pane', {})).toBe('Moved render pane');
    });
  });

  describe('webmcp: session filesystem tools', () => {
    it('lists session filesystem', () => {
      expect(summarizeToolCall('webmcp:list_session_filesystem', {})).toBe('Listed session files');
    });

    it('reads session folder with path', () => {
      expect(summarizeToolCall('webmcp:read_session_folder', { path: '/projects' })).toBe('Read folder projects');
    });

    it('reads session file with path', () => {
      expect(summarizeToolCall('webmcp:read_session_file', { path: '/foo/script.sh' })).toBe('Read script.sh');
    });

    it('creates session file with path', () => {
      expect(summarizeToolCall('webmcp:create_session_file', { path: '/foo/config.json' })).toBe('Created config.json');
    });

    it('creates session folder with path', () => {
      expect(summarizeToolCall('webmcp:create_session_folder', { path: '/foo/dist' })).toBe('Created folder dist');
    });

    it('writes session file with path', () => {
      expect(summarizeToolCall('webmcp:write_session_file', { path: '/foo/out.txt' })).toBe('Wrote out.txt');
    });

    it('deletes session filesystem entry with path', () => {
      expect(summarizeToolCall('webmcp:delete_session_filesystem_entry', { path: '/foo/temp.log' })).toBe(
        'Deleted temp.log',
      );
    });

    it('renames session filesystem entry', () => {
      expect(summarizeToolCall('webmcp:rename_session_filesystem_entry', { from: '/foo/old.ts', to: '/foo/new.ts' })).toBe(
        'Renamed old.ts to new.ts',
      );
    });

    it('scaffolds session filesystem entry', () => {
      expect(summarizeToolCall('webmcp:scaffold_session_filesystem_entry', {})).toBe('Scaffolded files');
    });

    it('lists session drives', () => {
      expect(summarizeToolCall('webmcp:list_session_drives', {})).toBe('Listed session drives');
    });

    it('mounts session drive', () => {
      expect(summarizeToolCall('webmcp:mount_session_drive', {})).toBe('Mounted session drive');
    });

    it('unmounts session drive', () => {
      expect(summarizeToolCall('webmcp:unmount_session_drive', {})).toBe('Unmounted session drive');
    });
  });

describe('webmcp: session tools', () => {
    it('reads session', () => {
      expect(summarizeToolCall('webmcp:read_session', {})).toBe('Read session');
    });

    it('lists session tools', () => {
      expect(summarizeToolCall('webmcp:list_session_tools', {})).toBe('Listed session tools');
    });

    it('submits session message', () => {
      expect(summarizeToolCall('webmcp:submit_session_message', { message: 'Hello!' })).toBe(
        'Submitted message to session',
      );
    });

    it('changes session agent', () => {
      expect(summarizeToolCall('webmcp:change_session_agent', {})).toBe('Changed session agent');
    });

    it('changes session model', () => {
      expect(summarizeToolCall('webmcp:change_session_model', {})).toBe('Changed session model');
    });

    it('switches session mode', () => {
      expect(summarizeToolCall('webmcp:switch_session_mode', {})).toBe('Switched session mode');
    });

    it('changes session tools', () => {
      expect(summarizeToolCall('webmcp:change_session_tools', {})).toBe('Changed session tools');
    });

    it('lists sessions', () => {
      expect(summarizeToolCall('webmcp:list_sessions', {})).toBe('Listed sessions');
    });

    it('creates session', () => {
      expect(summarizeToolCall('webmcp:create_session', {})).toBe('Created session');
    });
});

describe('webmcp: user context tools', () => {
  it('summarizes user-context MCP calls', () => {
    expect(summarizeToolCall('webmcp:recall_user_context', { query: 'location' })).toBe('Recalled user context for location');
    expect(summarizeToolCall('webmcp:read_browser_location', {})).toBe('Read browser location');
    expect(summarizeToolCall('webmcp:elicit_user_input', {})).toBe('Requested user input');
  });
});

describe('webmcp: workspace tools', () => {
    it('reads workspace overview', () => {
      expect(summarizeToolCall('webmcp:workspace_overview', {})).toBe('Read workspace overview');
    });

    it('reads workspace file with path', () => {
      expect(summarizeToolCall('webmcp:workspace_file', { path: '/AGENTS.md' })).toBe('Read workspace file AGENTS.md');
    });

    it('reads workspace file without path', () => {
      expect(summarizeToolCall('webmcp:workspace_file', {})).toBe('Read workspace file');
    });
  });

  describe('webmcp: worktree context tools', () => {
    it('lists worktree items', () => {
      expect(summarizeToolCall('webmcp:list_worktree_items', {})).toBe('Listed workspace items');
    });

    it('reads worktree render pane state', () => {
      expect(summarizeToolCall('webmcp:read_worktree_render_pane_state', {})).toBe('Read pane state');
    });

    it('toggles worktree render pane', () => {
      expect(summarizeToolCall('webmcp:toggle_worktree_render_pane', {})).toBe('Toggled render pane');
    });

    it('lists worktree context actions', () => {
      expect(summarizeToolCall('webmcp:list_worktree_context_actions', {})).toBe('Listed context actions');
    });

    it('invokes worktree context action', () => {
      expect(summarizeToolCall('webmcp:invoke_worktree_context_action', {})).toBe('Invoked context action');
    });

    it('reads worktree context menu state', () => {
      expect(summarizeToolCall('webmcp:read_worktree_context_menu_state', {})).toBe('Read context menu state');
    });

    it('toggles worktree context menu', () => {
      expect(summarizeToolCall('webmcp:toggle_worktree_context_menu', {})).toBe('Toggled context menu');
    });
  });

  describe('webmcp: unknown tool fallback', () => {
    it('converts unknown webmcp tool to Title Case', () => {
      expect(summarizeToolCall('webmcp:some_unknown_tool', {})).toBe('Some Unknown Tool');
    });
  });
});
