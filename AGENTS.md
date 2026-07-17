# Agent Instructions

- Always work in a separate branch.
- After authorized changes are validated and everything is OK, make sure the result lands on the repository primary branch (`master` or `main`) unless the user explicitly says not to.
- Always respond in English.
- Do not use UI unless explicitly allowed.
- Before merging any user-facing UI, layout, or visual change, verify the affected states in the real UI and capture screenshots. If UI use is not explicitly allowed, stop and request permission; do not merge the change without screenshot verification.
- Do not add new project script sources under repo-local `scripts/`. Store reusable helper scripts under `../ObsidianVault/scripts/projects/site-blocker/` and call them from package scripts or docs with repository-relative paths.
