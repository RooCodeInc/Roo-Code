---
title: Embedding Models Return Different Results for the Same Query
slug: embedding-models-return-different-results-for-the-same-query
description: Why different embedding models interpret semantic similarity differently, and how the choice between exact match and contextual match affects codebase search results.
primary_schema:
    - Article
    - FAQPage
tags:
    - embeddings
    - codebase-search
    - ai-models
    - developer-workflow
status: published
publish_date: "2025-09-25"
publish_time_pt: "9:00am"
source: "Roo Cast"
---

Search: "color"
Results: blue.txt, red.txt, green.txt

You wanted `styles.css`. You got a vocabulary list.

## The semantic gap

You're building a feature that touches the site's color system. You search your codebase for "color" to find where the styling lives. The search returns every file that mentions a color word. Blue. Red. Green. A constants file full of hex values. None of that helps you find where the CSS actually lives.

The embedding model that powers your codebase search is doing exactly what it was trained to do: returning semantically similar terms. "Color" and "blue" are related concepts. The model is not wrong. It is just not useful for your actual task.

Different embedding models interpret "semantic similarity" differently. Some treat similarity as lexical proximity: search for "blue" and you get files with "blue" and "color" and maybe "sky." Others interpret similarity as contextual relevance: search for "color" while working on a website and they return the CSS files and styling locations, not just word matches.

## The provider switch

One developer switched from OpenAI embeddings to Gemini and immediately noticed the difference. Not just in results, but in confidence scores.

> "When I switched to Gemini the first thing I saw was well this result is 0.8, it's from 0 to 1. I was like well it seems to be more confident about the results. Then I looked at them and it was bringing up stuff that was relevant to the query, but it wasn't an exact match."
>
> Dan, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI)

The Gemini results scored higher confidence but returned contextually relevant files rather than exact keyword matches. For codebase navigation, that contextual understanding made the search more useful for the actual task.

## Exact match vs. contextual match

The distinction matters for how you use codebase search in a workflow.

**Exact match models** work well when you know the specific term you need: the function name, the variable, the exact error string. You want precision. You want every instance of `handleAuth` returned.

**Contextual models** work better when you're orienting: you know the concept but not the naming conventions in this codebase. You're looking for "where authentication happens" not "the function literally named auth."

> "If you're looking for the word color, they're not going to just bring a list of colors, but if you're working on a website, they're going to give you the location of where the CSS is, where the styling is."
>
> Dan, [Roo Cast S01E10](https://www.youtube.com/watch?v=BWxsa_JxGZI)

Neither behavior is objectively correct. The tradeoff is between precision and recall, between "give me exactly what I typed" and "give me what I probably meant."

## The reindexing reality

Switching embedding providers is not a hot-swap operation. Different models create different vector representations of the same content. Your existing index becomes invalid.

Teams relying on codebase search for agent workflows should expect:

1. **Reindexing time**: The entire codebase needs to be re-embedded with the new model
2. **Result drift**: Queries that worked before may return different results
3. **Confidence recalibration**: Score thresholds that made sense for one model may need adjustment for another

This is not a bug. It is the nature of embedding spaces. Two models can both be "correct" while returning different results for the same query.

## Why this matters for your workflow

If you're using codebase indexing to give an AI agent context about your repository, the embedding model shapes what context gets retrieved. A model that returns exact matches will give the agent files containing the literal search terms. A model that returns contextual matches will give the agent files that might be more relevant to the actual task, even if they don't contain the exact words.

For complex codebases with inconsistent naming, contextual understanding helps. For codebases with clear conventions where you know exactly what you're looking for, exact matching may be more predictable.

The first step: test your current search behavior. Run a few queries where you know what result you want. If the results don't match your expectations, the embedding model may be optimizing for a different definition of "similar" than you need.

## How Roo Code handles embedding model flexibility

Roo Code supports BYOK (bring your own key) for embedding providers, which means you control which embedding model indexes your codebase. When an agent needs context to close the loop on a task, the quality of retrieved files directly affects whether the agent can propose accurate diffs, run the right tests, and iterate effectively.

Because Roo Code lets you configure your embedding provider, you can switch from OpenAI to Gemini to test which model returns more useful results for your specific codebase structure. The agent uses whatever context the embedding model retrieves, so choosing the right model for your naming conventions and code organization improves the agent's ability to complete tasks without manual intervention.

**Roo Code's BYOK architecture means embedding model choice is a user decision, not a vendor lock-in.**

## Comparing embedding model approaches

| Dimension                    | Exact Match Models                                      | Contextual Match Models                         |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Best for                     | Known function names, specific variables, error strings | Concept-based exploration, unfamiliar codebases |
| Search behavior              | Returns files containing literal query terms            | Returns files related to query intent           |
| Confidence scores            | Typically binary (match or no match)                    | Graded relevance scoring                        |
| Naming convention dependency | High - requires knowing exact terms                     | Low - interprets meaning over syntax            |
| Agent context quality        | Precise but narrow                                      | Broader but may include tangential files        |

## Frequently asked questions

### Why do different embedding models return different results for the same search query?

Embedding models convert text into numerical vectors, and each model uses different training data and architectures to define what "similar" means. OpenAI embeddings may weight lexical overlap heavily, while Gemini embeddings may prioritize contextual relationships. Neither is wrong - they optimize for different definitions of similarity.

### Should I reindex my codebase when switching embedding providers?

Yes. Vector representations are model-specific. An index created with OpenAI embeddings is incompatible with Gemini embeddings. Expect reindexing time proportional to your codebase size, and plan for result differences that may require threshold adjustments.

### How does embedding model choice affect Roo Code's ability to complete tasks?

When Roo Code retrieves context for a task, the embedding model determines which files get surfaced. Contextual models may help the agent find relevant code even when naming conventions are inconsistent. Exact match models work better when you specify precise file or function names in your task description.

### What is the tradeoff between precision and recall in codebase search?

Precision means returning only relevant results. Recall means returning all relevant results. Exact match models favor precision - fewer results, but highly targeted. Contextual models favor recall - more results that might be relevant, but some may be tangential. The right balance depends on whether you're exploring or targeting.

### How can I test which embedding model works best for my codebase?

Run benchmark queries where you already know the expected results. Search for a concept and check if the returned files match what you would manually select. If exact matches work well, your codebase has consistent naming. If contextual matches work better, your codebase may benefit from semantic interpretation.
