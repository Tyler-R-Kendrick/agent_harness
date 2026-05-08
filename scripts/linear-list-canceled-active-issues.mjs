import { stdin as input, stdout as output } from 'node:process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';

function parseArgs(argv) {
  const options = {
    team: 'TK',
    stateType: 'canceled',
    limit: 100,
    json: false,
    stdin: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--team') {
      options.team = requireValue(argv[++index], arg);
    } else if (arg === '--state-type') {
      options.stateType = normalizeStateType(requireValue(argv[++index], arg));
    } else if (arg === '--state') {
      options.stateType = normalizeStateType(requireValue(argv[++index], arg));
    } else if (arg === '--limit') {
      options.limit = Number(requireValue(argv[++index], arg));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--stdin') {
      options.stdin = true;
    } else if (arg === '--from-json') {
      options.stdin = true;
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        options.jsonInputPath = next;
        index += 1;
      }
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 250) {
    throw new Error('--limit must be an integer from 1 to 250.');
  }

  return options;
}

function normalizeStateType(value) {
  return value.trim().toLowerCase();
}

function requireValue(value, flag) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function usage() {
  return [
    'Usage: node scripts/linear-list-canceled-active-issues.mjs [--team TK] [--state-type canceled] [--limit 100] [--json]',
    '       node scripts/linear-list-canceled-active-issues.mjs --from-json -',
    '',
    'Requires LINEAR_API_KEY unless --stdin is used with a JSON object containing an issues array.',
  ].join('\n');
}

async function readInputJson(path) {
  if (path && path !== '-') {
    return JSON.parse(await readFile(path, 'utf8'));
  }

  const chunks = [];
  for await (const chunk of input) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return { issues: [] };
  return JSON.parse(raw);
}

async function fetchCanceledIssues({ team, stateType, limit }) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY is required. Use the connected Linear app in Codex, or set LINEAR_API_KEY for this script.');
  }

  const issues = [];
  let cursor = null;
  do {
    const response = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query CanceledIssues($team: String!, $stateType: String!, $first: Int!, $after: String) {
            issues(
              first: $first
              after: $after
              filter: {
                team: { key: { eq: $team } }
                state: { type: { eq: $stateType } }
                archivedAt: { null: true }
              }
            ) {
              nodes {
                identifier
                title
                url
                priority
                updatedAt
                canceledAt
                state { name type }
                assignee { name email }
                labels { nodes { name } }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        `,
        variables: {
          team,
          stateType,
          first: Math.min(limit - issues.length, 100),
          after: cursor,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Linear API request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join('\n'));
    }

    const connection = payload.data?.issues;
    issues.push(...normalizeIssues(connection?.nodes ?? []));
    cursor = connection?.pageInfo?.hasNextPage && issues.length < limit
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);

  return issues.slice(0, limit);
}

function normalizeIssues(rawIssues) {
  return rawIssues.map((issue) => ({
    id: issue.identifier ?? issue.id,
    title: issue.title,
    status: issue.state?.name ?? issue.status,
    statusType: issue.state?.type ?? issue.statusType,
    assignee: issue.assignee?.name ?? issue.assignee ?? null,
    labels: issue.labels?.nodes?.map((label) => label.name) ?? issue.labels ?? [],
    updatedAt: issue.updatedAt,
    canceledAt: issue.canceledAt,
    url: issue.url,
  }));
}

function formatMarkdown(issues) {
  if (!issues.length) return 'No canceled active Linear issues found.';
  return [
    `Canceled active Linear issues (${issues.length})`,
    ...issues.map((issue) => {
      const labelText = issue.labels?.length ? ` [${issue.labels.join(', ')}]` : '';
      const assignee = issue.assignee ? ` - ${issue.assignee}` : '';
      return `- ${issue.id}: ${issue.title}${labelText}${assignee}`;
    }),
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    output.write(`${usage()}\n`);
    return;
  }

  const issues = options.stdin
    ? normalizeIssues(readIssuesFromJson(await readInputJson(options.jsonInputPath)))
    : await fetchCanceledIssues(options);

  output.write(options.json
    ? `${JSON.stringify({ issues }, null, 2)}\n`
    : `${formatMarkdown(issues)}\n`);
}

function readIssuesFromJson(payload) {
  return payload.issues
    ?? payload.data?.issues?.nodes
    ?? [];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
