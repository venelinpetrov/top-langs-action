#!/usr/bin/env node

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TOP_N = Number(process.env.TOP_N || process.argv[2] || 5);

if (!GITHUB_TOKEN) {
	console.error("Missing GITHUB_TOKEN");
	process.exit(1);
}

const QUERY = `
query ViewerTopLanguages {
  viewer {
    repositories(
      first: 100
      ownerAffiliations: OWNER
      isFork: false
      privacy: PUBLIC
    ) {
      nodes {
        isArchived
        languages(first: 20) {
          edges {
            size
            node {
              name
            }
          }
        }
      }
    }
  }
}
`;

async function fetchLanguages() {
	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: QUERY })
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }

  return json.data.viewer.repositories.nodes;
}

function aggregateLanguages(repos) {
  const totals = new Map();

  for (const repo of repos) {
    if (repo.isArchived) continue;

    for (const edge of repo.languages.edges) {
      const lang = edge.node.name;
      const size = edge.size;

      totals.set(lang, (totals.get(lang) || 0) + size);
    }
  }

  return totals;
}

function computeTopLanguages(totals, topN) {
  const entries = [...totals.entries()]
    .map(([language, bytes]) => ({ language, bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);

  const top = entries.slice(0, topN);
  const rest = entries.slice(topN);

  const result = top.map(e => ({
    language: e.language,
    percent: +(e.bytes / totalBytes * 100).toFixed(1)
  }));

  if (rest.length > 0) {
    const restBytes = rest.reduce((sum, e) => sum + e.bytes, 0);
    result.push({
      language: "Other",
      percent: +(restBytes / totalBytes * 100).toFixed(1)
    });
  }

  return result;
}

async function main() {
  const repos = await fetchLanguages();
  const totals = aggregateLanguages(repos);
  const stats = computeTopLanguages(totals, TOP_N);

  console.log(JSON.stringify(stats, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
