function truncateText(value: string, maxLength = 96): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function basename(path: string): string {
  const normalized = path.replace(/\\+/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function summarizeToolCall(toolName: string, args: unknown): string {
  if (toolName === 'cli' && isRecord(args)) {
    const command = readString(args.command);
    if (command) {
      return `$ ${command.trim()}`;
    }
  }

  if (toolName === 'read_file' && isRecord(args)) {
    const filePath = readString(args.filePath);
    const startLine = readNumber(args.startLine);
    const endLine = readNumber(args.endLine);
    if (filePath && startLine !== null && endLine !== null) {
      return `Read ${basename(filePath)}, lines ${startLine} to ${endLine}`;
    }
  }

  if (toolName === 'create_directory' && isRecord(args)) {
    const dirPath = readString(args.dirPath);
    if (dirPath) {
      return `Created ${basename(dirPath)}`;
    }
  }

  if (toolName === 'create_file' && isRecord(args)) {
    const filePath = readString(args.filePath);
    if (filePath) {
      return `Created ${basename(filePath)}`;
    }
  }

  if (toolName === 'apply_patch') {
    return 'Applied patch';
  }

  if (toolName.startsWith('webmcp:')) {
    return summarizeWebMcpCall(toolName.slice('webmcp:'.length), args);
  }

  if (isRecord(args)) {
    const summary = truncateText(JSON.stringify(args));
    return `${toolName}: ${summary}`;
  }

  return toolName;
}

function summarizeWebMcpCall(name: string, args: unknown): string {
  const at = isRecord(args);

  // Filesystem
  if (name === 'list_filesystem_entries') {
    const query = at ? readString(args.query) : null;
    const parentPath = at ? readString(args.parentPath) : null;
    if (query) return `Searched for "${query}"`;
    if (parentPath && parentPath !== '/') return `Listed entries in ${parentPath}`;
    return 'Listed filesystem entries';
  }
  if (name === 'read_filesystem_properties') {
    const path = at ? readString(args.path) : null;
    return path ? `Read properties of ${basename(path)}` : 'Read file properties';
  }
  if (name === 'read_filesystem_history') return 'Read file history';
  if (name === 'rollback_filesystem_history') return 'Rolled back file history';
  if (name === 'change_filesystem_mount') return 'Changed filesystem mount';
  if (name === 'add_filesystem_entry') {
    const path = at ? readString(args.path) : null;
    return path ? `Added ${basename(path)}` : 'Added filesystem entry';
  }
  if (name === 'update_filesystem_entry') {
    const path = at ? readString(args.path) : null;
    return path ? `Updated ${basename(path)}` : 'Updated filesystem entry';
  }
  if (name === 'remove_filesystem_entry') {
    const path = at ? readString(args.path) : null;
    return path ? `Removed ${basename(path)}` : 'Removed filesystem entry';
  }

  // Clipboard
  if (name === 'list_clipboard_history') return 'Listed clipboard history';
  if (name === 'read_clipboard_entry') return 'Read clipboard entry';
  if (name === 'restore_clipboard_entry') return 'Restored clipboard entry';

  // Browser pages
  if (name === 'list_browser_pages') return 'Listed browser pages';
  if (name === 'read_browser_page') return 'Read browser page';
  if (name === 'read_browser_page_history') return 'Read page history';
  if (name === 'create_browser_page') return 'Created browser page';
  if (name === 'navigate_browser_page') {
    const url = at ? readString(args.url) : null;
    return url ? `Navigated to ${url}` : 'Navigated browser page';
  }
  if (name === 'navigate_browser_page_history') return 'Navigated page history';
  if (name === 'refresh_browser_page') return 'Refreshed browser page';

  // Render panes
  if (name === 'list_render_panes') return 'Listed render panes';
  if (name === 'close_render_pane') return 'Closed render pane';
  if (name === 'move_render_pane') return 'Moved render pane';

  // Session filesystem
  if (name === 'list_session_filesystem') return 'Listed session files';
  if (name === 'read_session_folder') {
    const path = at ? readString(args.path) : null;
    return path ? `Read folder ${basename(path)}` : 'Read session folder';
  }
  if (name === 'read_session_file') {
    const path = at ? readString(args.path) : null;
    return path ? `Read ${basename(path)}` : 'Read session file';
  }
  if (name === 'create_session_file') {
    const path = at ? readString(args.path) : null;
    return path ? `Created ${basename(path)}` : 'Created session file';
  }
  if (name === 'create_session_folder') {
    const path = at ? readString(args.path) : null;
    return path ? `Created folder ${basename(path)}` : 'Created session folder';
  }
  if (name === 'write_session_file') {
    const path = at ? readString(args.path) : null;
    return path ? `Wrote ${basename(path)}` : 'Wrote session file';
  }
  if (name === 'delete_session_filesystem_entry') {
    const path = at ? readString(args.path) : null;
    return path ? `Deleted ${basename(path)}` : 'Deleted session entry';
  }
  if (name === 'rename_session_filesystem_entry') {
    const from = at ? readString(args.from) : null;
    const to = at ? readString(args.to) : null;
    if (from && to) return `Renamed ${basename(from)} to ${basename(to)}`;
    return 'Renamed session entry';
  }
  if (name === 'scaffold_session_filesystem_entry') return 'Scaffolded files';
  if (name === 'list_session_drives') return 'Listed session drives';
  if (name === 'mount_session_drive') return 'Mounted session drive';
  if (name === 'unmount_session_drive') return 'Unmounted session drive';

  // Sessions
  if (name === 'list_sessions') return 'Listed sessions';
  if (name === 'create_session') return 'Created session';
  if (name === 'read_session') return 'Read session';
  if (name === 'list_session_tools') return 'Listed session tools';
  if (name === 'submit_session_message') return 'Submitted message to session';
  if (name === 'change_session_agent') return 'Changed session agent';
  if (name === 'change_session_model') return 'Changed session model';
  if (name === 'switch_session_mode') return 'Switched session mode';
  if (name === 'change_session_tools') return 'Changed session tools';

  // User context
  if (name === 'recall_user_context') {
    const query = at ? readString(args.query) : null;
    return query ? `Recalled user context for ${query}` : 'Recalled user context';
  }
  if (name === 'read_browser_location') return 'Read browser location';
  if (name === 'elicit_user_input') return 'Requested user input';

  // Search
  if (name === 'search_web') {
    const query = at ? readString(args.query) : null;
    return query ? `Searched web for "${query}"` : 'Searched web';
  }
  if (name === 'read_web_page') {
    const url = at ? readString(args.url) : null;
    return url ? `Read web page ${url}` : 'Read web page';
  }
  // Workspace
  if (name === 'workspace_overview') return 'Read workspace overview';
  if (name === 'workspace_file') {
    const path = at ? readString(args.path) : null;
    return path ? `Read workspace file ${basename(path)}` : 'Read workspace file';
  }

  // Worktree / context
  if (name === 'list_worktree_items') return 'Listed workspace items';
  if (name === 'read_worktree_render_pane_state') return 'Read pane state';
  if (name === 'toggle_worktree_render_pane') return 'Toggled render pane';
  if (name === 'list_worktree_context_actions') return 'Listed context actions';
  if (name === 'invoke_worktree_context_action') return 'Invoked context action';
  if (name === 'read_worktree_context_menu_state') return 'Read context menu state';
  if (name === 'toggle_worktree_context_menu') return 'Toggled context menu';

  // Fallback: convert snake_case to Title Case
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatToolArgs(args: unknown): string | undefined {
  if (args === undefined) {
    return undefined;
  }
  return JSON.stringify(args, null, 2);
}

export function summarizeToolResult(toolName: string, result: unknown): string | undefined {
  if (toolName === 'cli' && isRecord(result)) {
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const exitCode = readNumber(result.exitCode);
    const combined = [stdout, stderr].filter(Boolean).join('\n');

    if (combined) {
      return combined;
    }

    if (exitCode !== null) {
      return exitCode === 0 ? 'Command completed.' : `Command exited with code ${exitCode}.`;
    }
  }

  if (typeof result === 'string') {
    return result;
  }

  if (result === undefined) {
    return undefined;
  }

  return JSON.stringify(result, null, 2);
}
