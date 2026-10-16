# Domain docs

## Layout and reading rules

This repository uses a single-context layout:

- `GLOSSARY.md` at the repository root defines domain vocabulary.
- `docs/adr/` holds architecture decision records.

Before exploring the codebase, read the glossary and ADRs relevant to
the area being changed.

If these files are absent, proceed silently. The `/domain-modeling`
skill creates them when terms or decisions are resolved; creating
placeholder domain documents is unnecessary.

## Vocabulary

Use glossary terms in issue titles, refactor proposals, hypotheses,
and test names. Respect explicitly excluded synonyms.

If a concept is missing, reconsider whether the proposed term fits
the project. Note genuine vocabulary gaps for `/domain-modeling`.

## Decision conflicts

Explicitly identify any existing ADR that a proposal contradicts and
explain why reopening that decision may be justified.
