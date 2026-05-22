# CAJAL Scientific Paper Generator Mode

A custom Roo Code mode for generating publication-ready scientific papers with real arXiv citations and a multi-pass tribunal scoring workflow.

Based on the [CAJAL project](https://github.com/Agnuxo1/CAJAL) by [@agnuxo1](https://github.com/Agnuxo1).

## What It Does

The Paper Generator mode turns Roo Code into an academic writing assistant that:

- Generates structured 7-section research papers (Abstract, Introduction, Related Work, Methodology, Results, Discussion, Conclusion)
- Sources real citations from arXiv (search + abstract retrieval + BibTeX formatting)
- Runs a "tribunal" review: 3 simulated reviewers score each section on a 0-10 scale
- Iteratively rewrites sections scoring below 7 until all meet the quality threshold (max 3 iterations)
- Outputs Markdown or LaTeX with proper academic formatting

## Installation

### Option 1: Copy the `.roomodes` file (project-level)

1. Copy the [`.roomodes`](.roomodes) file from this directory into your project root
2. Open the project in VS Code with Roo Code installed
3. The "Paper Generator" mode will appear in the mode selector

If your project already has a `.roomodes` file, merge the `paper` mode entry into your existing `customModes` array.

### Option 2: Global installation via `custom_modes.yaml`

Add the mode definition to your global `custom_modes.yaml` file (located in your Roo Code settings directory):

```yaml
customModes:
    - slug: paper
      name: "\U0001F4DD Paper Generator"
      roleDefinition: |-
          You are CAJAL, a scientific paper writing assistant...
      # (copy the full definition from the .roomodes file)
```

## Recommended Setup

### Using with CAJAL via Ollama (best results)

For the full CAJAL experience, run the CAJAL model locally through Ollama:

1. Install [Ollama](https://ollama.ai)
2. Pull the CAJAL model: `ollama run cajal-p2pclaw`
3. In Roo Code, select Ollama as your API provider and point it to your local Ollama instance
4. Select `cajal-p2pclaw` as the model
5. Switch to Paper Generator mode

### Using with any LLM provider

The mode works with any LLM provider supported by Roo Code (OpenAI, Anthropic, etc.). The structured prompts and tribunal workflow are provider-agnostic -- you just won't get the CAJAL-specific optimizations for scientific writing.

## Usage

1. Switch to the "Paper Generator" mode in Roo Code
2. Describe your research topic. For example:

    > Write a paper on transformer architectures for protein structure prediction, focusing on attention mechanisms that capture long-range amino acid interactions.

3. The mode will:

    - **Pass 1**: Generate a full 7-section draft with arXiv citations
    - **Pass 2**: Run tribunal review (3 reviewers scoring each section)
    - **Pass 3**: Rewrite any sections below the quality threshold

4. Output files are restricted to `.md`, `.tex`, `.bib`, `.txt`, `.csv`, and `.json` extensions

## File Restrictions

The mode can read any file in your project but can only write to:

- Markdown files (`.md`)
- LaTeX files (`.tex`)
- Bibliography files (`.bib`)
- Text files (`.txt`)
- Data files (`.csv`, `.json`)

This prevents accidental modifications to source code while working on papers.

## How the Tribunal Works

The tribunal simulates an academic peer review process:

| Criterion                 | Description                                     |
| ------------------------- | ----------------------------------------------- |
| Clarity and coherence     | Is the writing clear and logically structured?  |
| Technical accuracy        | Are claims and methods technically sound?       |
| Depth of analysis         | Is the topic explored with sufficient depth?    |
| Proper use of citations   | Are citations relevant and correctly formatted? |
| Contribution to the field | Does the paper add meaningful value?            |

Each of the 3 reviewers scores every section on these criteria. Sections averaging below 7/10 are flagged for rewriting. The process repeats up to 3 times.

## Related

- [CAJAL Project](https://github.com/Agnuxo1/CAJAL) - The original CAJAL scientific paper generation system
- [Roo Code Custom Modes Documentation](https://docs.roocode.com/features/custom-modes) - How custom modes work
- [Issue #12256](https://github.com/RooCodeInc/Roo-Code/issues/12256) - Original integration proposal
