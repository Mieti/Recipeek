# Issue tracker: GitHub

Issues and specs live at https://github.com/Mieti/Recipeek/issues.
Use the `gh` CLI and pass `--repo Mieti/Recipeek` for issue operations.

## Conventions

- Create: `gh issue create --repo Mieti/Recipeek --title "..." --body-file <path>`.
- Read: `gh issue view <number> --repo Mieti/Recipeek --json number,title,body,labels,comments`.
- List: `gh issue list --repo Mieti/Recipeek --state open --json number,title,body,labels,comments`, with appropriate filters.
- Create a sub-issue: add `--parent <parent-number>` when creating it.
- Link an existing child: `gh issue edit <parent-number> --repo Mieti/Recipeek --add-sub-issue <child-number>`.
- Comment: `gh issue comment <number> --repo Mieti/Recipeek --body-file <path>`.
- Label: `gh issue edit <number> --repo Mieti/Recipeek --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --repo Mieti/Recipeek`.

Write multiline bodies to a temporary UTF-8 file and use `--body-file`.
Use the role mapping in `triage-labels.md`.

Sub-issue and dependency flags require gh 2.94 or later. If unavailable,
link children with `Part of #<parent>` and a task list in the parent;
record dependencies as `Blocked by: #<number>, #<number>`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares issue and pull-request numbers. Resolve an ambiguous number
with `gh pr view <number> --repo Mieti/Recipeek`; if it is not a PR,
read it with `gh issue view`.

## Skill operations

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the referenced GitHub issue.

## Wayfinding operations

Used by `/wayfinder`.

- Map: one issue labelled `wayfinder:map`, with Notes, Decisions-so-far,
  and Fog sections.
- Child: one sub-issue per ticket, labelled `wayfinder:<type>`, where
  type is `research`, `prototype`, `grilling`, or `task`.
- Blocking: use native dependencies with
  `gh issue edit <child-number> --repo Mieti/Recipeek --add-blocked-by <blocker-number>`.
  A ticket is unblocked when every blocker is closed.
- Frontier: inspect the map's open children in map order; choose the
  first with no open blockers and no assignee.
- Claim: assign the ticket to the driving developer before work with
  `gh issue edit <number> --repo Mieti/Recipeek --add-assignee "@me"`.
- Resolve: comment with the answer, close the child, then append a gist
  and link to the map's Decisions-so-far section.

Create missing wayfinder labels when first using that workflow.
