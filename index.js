#!/usr/bin/env node

import * as core from "@actions/core";
import fs from "fs";
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || core.getInput("github_token");
const TOP_N = Number(process.env.TOP_N || core.getInput("top_n") || 5);
const workspace = process.env.WORKSPACE || process.cwd();
const outputPath = process.env.OUTPUT_PATH || 'profile/top-langs.svg'
console.log(TOP_N, '<<<<<<<<topN')
const COLORS = [
	"#4F8EF7",
	"#F7B32F",
	"#F75F4F",
	"#6FCF97",
	"#9B51E0",
	"#F2994A",
	"#56CCF2",
];

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

function renderBarSVG(stats, width = 600, barHeight = 40, legendItemHeight = 20, padding = 10, title = "Top Languages") {
	const titleHeight = 20;
	const svgHeight = titleHeight + padding + barHeight + stats.length * legendItemHeight + padding;

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${svgHeight}">`;

	// Black background
	svg += `<rect x="0" y="0" width="${width}" height="${svgHeight}" fill="#000" />`;

	// Title
	svg += `<text x="${width / 2}" y="${titleHeight}" font-family="monospace" font-size="16" fill="#fff" text-anchor="middle">${title}</text>`;

	// Draw bar
	let x = padding;
	const barWidth = width - padding * 2;
	stats.forEach((stat, idx) => {
		const sliceWidth = (stat.percent / 100) * barWidth;
		const color = COLORS[idx % COLORS.length];
		svg += `<rect x="${x}" y="${titleHeight + padding}" width="${sliceWidth}" height="${barHeight}" fill="${color}" />`;
		x += sliceWidth;
	});

	// Draw vertical legend
	let legendY = titleHeight + padding + barHeight + padding;
	stats.forEach((stat, idx) => {
		const color = COLORS[idx % COLORS.length];
		const squareSize = 15;
		const textX = padding + squareSize + 5;
		const textY = legendY + squareSize - 3;

		// Color square
		svg += `<rect x="${padding}" y="${legendY}" width="${squareSize}" height="${squareSize}" fill="${color}" />`;
		// Text label
		svg += `<text x="${textX}" y="${textY}" font-family="sans-serif" font-size="12" fill="#fff">${stat.language} ${stat.percent}%</text>`;

		legendY += legendItemHeight;
	});

	svg += "</svg>";
	return svg;
}

async function main() {
	const repos = await fetchLanguages();
	const totals = aggregateLanguages(repos);
	const stats = computeTopLanguages(totals, TOP_N);
	const svg = renderBarSVG(stats);
	const absoluteOutputPath = path.join(workspace, outputPath);

	fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
	fs.writeFileSync(absoluteOutputPath, svg);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
