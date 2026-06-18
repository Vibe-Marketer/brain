#!/usr/bin/env node

const OPENAPI_URL =
  "https://raw.githubusercontent.com/api-evangelist/calendly/refs/heads/main/openapi/calendly-scheduling-api-openapi.yml";

const RECORDING_TERMS = [
  "recording",
  "recordings",
  "transcript",
  "transcripts",
  "notetaker",
  "recap",
  "audio",
  "video",
];

const response = await fetch(OPENAPI_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch OpenAPI: ${response.status} ${response.statusText}`);
}

const spec = await response.text();
const pathMatches = [...spec.matchAll(/^  \/(.+):$/gm)].map((match) => `/${match[1]}`);
const pathKeywordMatches = pathMatches.filter((path) =>
  RECORDING_TERMS.some((term) => path.toLowerCase().includes(term)),
);
const recordingMatches = RECORDING_TERMS.map((term) => ({
  term,
  count: (spec.match(new RegExp(term, "gi")) ?? []).length,
})).filter((entry) => entry.count > 0);

console.log(JSON.stringify({
  openapiUrl: OPENAPI_URL,
  pathCount: pathMatches.length,
  paths: pathMatches,
  pathKeywordMatches,
  bodyKeywordMatches: recordingMatches,
  verdict:
    pathKeywordMatches.length === 0
      ? "No recording/transcript/notetaker/recap/audio/video API paths appear in the public Calendly Scheduling API snapshot."
      : "Recording-related paths appeared; inspect matches manually before assuming API support.",
}, null, 2));
