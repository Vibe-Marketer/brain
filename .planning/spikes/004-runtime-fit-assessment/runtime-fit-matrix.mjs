#!/usr/bin/env node

const weights = {
  currentRepoFit: 3,
  edgeRuntimeFit: 3,
  openapiTooling: 2,
  cliDistribution: 2,
  operationalSimplicity: 3,
}

const candidates = {
  'Deno Edge Functions': {
    currentRepoFit: 2,
    edgeRuntimeFit: 5,
    openapiTooling: 3,
    cliDistribution: 2,
    operationalSimplicity: 4,
  },
  'Node + npm': {
    currentRepoFit: 5,
    edgeRuntimeFit: 2,
    openapiTooling: 5,
    cliDistribution: 5,
    operationalSimplicity: 5,
  },
  Bun: {
    currentRepoFit: 1,
    edgeRuntimeFit: 1,
    openapiTooling: 4,
    cliDistribution: 3,
    operationalSimplicity: 2,
  },
}

const scored = Object.entries(candidates)
  .map(([name, scores]) => ({
    name,
    score: Object.entries(weights).reduce((sum, [key, weight]) => sum + scores[key] * weight, 0),
    scores,
  }))
  .sort((a, b) => b.score - a.score)

console.log(JSON.stringify({ weights, scored }, null, 2))

