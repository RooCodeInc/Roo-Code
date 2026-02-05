# Changesets

This directory contains changesets. Every time you make a change that should be released, you add a changeset file here.

## How to create a changeset

1. Run `pnpm changeset` from the root of the monorepo
2. Select the packages that changed
3. Write a summary of the changes
4. Save the file

## How to release

1. Run `pnpm changeset version` to update version numbers and package.json files
2. Run `pnpm changeset publish` to publish the packages to npm
