---
title: Local Embedding Models Are Production-Ready
slug: local-embedding-models-are-productionready
description: Local embedding models like Ollama's nomic-embed-text now match OpenAI quality for codebase semantic search, enabling teams with strict compliance requirements to deploy without external data egress.
primary_schema:
    - Article
    - FAQPage
tags:
    - embeddings
    - local-models
    - compliance
    - semantic-search
status: draft
publish_date: "2025-07-02"
publish_time_pt: "9:00am"
source: "Office Hours"
---

The local model runs at half speed.

For most teams, it's still the right choice.

## The compliance wall

Your security team says no code can leave the network. Your engineering team wants semantic search for the codebase. These two constraints have been in a staring contest for months.

The assumption: local embedding models are a toy. Cloud embeddings from OpenAI or Anthropic are the only production-grade option. If you cannot send code to external servers, you cannot have semantic search.

That assumption is outdated.

## The local option is now viable

The nomic embedding model running locally through Ollama performs on par with OpenAI's text-embedding-small-3. Not close enough. On par.

> "The nomic model from Ollama is actually pretty good. I think it's on par with small from OpenAI small 3. So you can use all local setup and it's going to get you pretty good results."
>
> Hannes Rudolph, [Office Hours S01E12](https://www.youtube.com/watch?v=QmmyZ2h7ffU&t=3276)

This changes the calculus. Teams that dismissed local indexing because of quality concerns can revisit that decision.

The setup is straightforward: install Ollama, pull the nomic-embed-text model, point your indexing workflow at localhost. No API keys to rotate, no egress to audit, no data leaving your infrastructure.

## The tradeoff: throughput

Local embeddings run at about half the throughput of OpenAI's API. For a large codebase, the initial indexing pass takes longer. For incremental updates on active development, the difference rarely matters.

If your constraint is compliance, not speed, this tradeoff is acceptable. You can run indexing overnight during the initial setup and handle incremental updates during low-traffic hours.

If speed is critical and external calls are acceptable, Google offers a middle path: text-embedding-004 with 1,500 free requests per minute.

> "There's a Google model for free that you can get for embeddings. It's text embedding 004 and it's I think 1,500 requests a minute that you get for free, which is quite decent for most of the people if they want to go that way."
>
> Hannes Rudolph, [Office Hours S01E12](https://www.youtube.com/watch?v=QmmyZ2h7ffU&t=3482)

That rate limit covers most indexing workflows for teams under 50 engineers.

## Embedding approach comparison

| Dimension        | Cloud embeddings (OpenAI)           | Local embeddings (Ollama + nomic)           |
| ---------------- | ----------------------------------- | ------------------------------------------- |
| Data egress      | Code sent to external servers       | None - runs entirely on your infrastructure |
| Throughput       | Highest available                   | Approximately 50% of cloud speed            |
| Cost             | Per-token pricing                   | Zero                                        |
| Compliance       | Requires security exception         | Passes most data residency requirements     |
| Setup complexity | API key management, egress auditing | Single install, no external dependencies    |

## How Roo Code closes the loop on local embeddings

Roo Code supports BYOK (bring your own key) architecture, which means you choose your embedding provider. Point Roo Code at a local Ollama instance running nomic-embed-text and your codebase indexing stays fully on-premises. The agent can then use that indexed context to propose changes, run tests, and iterate on failures without any of your code leaving your network.

This is the "close the loop" principle applied to compliance-constrained environments: the AI coding agent reads your codebase, suggests diffs, executes commands, and refines based on results, all while respecting your data residency requirements.

## Decision matrix

**Option A: Fully local (Ollama + nomic)**

- Throughput: ~50% of OpenAI
- Data egress: None
- Cost: Zero
- Best for: Teams with strict compliance requirements

**Option B: Google free tier (text-embedding-004)**

- Throughput: 1,500 requests/minute
- Data egress: Google Cloud
- Cost: Zero up to rate limit
- Best for: Teams who can use external APIs but want to avoid paid tiers

**Option C: OpenAI (text-embedding-small-3)**

- Throughput: Highest
- Data egress: OpenAI servers
- Cost: Per-token pricing
- Best for: Teams where speed is critical and cloud embeddings are approved

## Why this matters for your organization

For a 20-person engineering team evaluating codebase indexing, the blocker has often been "we cannot send code externally." That blocker now has a workaround.

The local option means you can:

1. Deploy semantic search without a security exception
2. Run indexing on air-gapped environments
3. Avoid vendor lock-in on a core capability

The quality tradeoff is gone. The speed tradeoff exists but is manageable. The compliance tradeoff disappears entirely.

## First step

If your team has been blocked on codebase indexing due to data residency concerns, run a proof of concept with Ollama and nomic-embed-text.

Measure the indexing time for your actual codebase. If it completes overnight, you have your answer.

## Frequently asked questions

### Are local embedding models accurate enough for production use?

Yes. The nomic-embed-text model running through Ollama performs on par with OpenAI's text-embedding-small-3. Quality is no longer a differentiator between local and cloud options. The tradeoff has shifted entirely to throughput and compliance requirements.

### How long does initial codebase indexing take with local embeddings?

Local embeddings run at approximately 50% of cloud API throughput. For most teams, this means initial indexing can complete overnight. Incremental updates during active development are fast enough that the difference is rarely noticeable in practice.

### Can I use local embeddings with Roo Code for codebase context?

Yes. Roo Code's BYOK architecture lets you point to any embedding provider, including a local Ollama instance. Configure your Ollama endpoint, and Roo Code will use your local nomic-embed-text model for all codebase indexing. No code leaves your network.

### What if I need faster embeddings but still want to avoid paid tiers?

Google's text-embedding-004 offers 1,500 free requests per minute. This rate limit covers most indexing workflows for teams under 50 engineers. You trade some data egress (to Google Cloud) for higher throughput without per-token costs.

### Do local embeddings work in air-gapped environments?

Yes. Once you have Ollama and the nomic-embed-text model installed, no network connectivity is required. This makes local embeddings the only viable option for teams operating in fully disconnected environments.
