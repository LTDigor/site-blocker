# Agent Instructions

- Always work in a separate branch.
- After authorized changes are validated and everything is OK, make sure the result lands on the repository primary branch (`master` or `main`) unless the user explicitly says not to.
- Always respond in English.
- Do not use UI unless explicitly allowed. When preparing a PR, the agent may use UI without separate user permission to verify the change before creating the PR; this authorization does not extend to unrelated UI actions.
- Before creating a PR or merging any user-facing UI, layout, or visual change, the agent must verify the affected states in the real UI and capture screenshots. This verification is the agent's responsibility; do not ask the user to perform it. If the agent cannot complete it, stop before creating the PR and report the blocker.
- Do not add new project script sources under repo-local `scripts/`. Store reusable helper scripts under `../ObsidianVault/scripts/projects/site-blocker/` and call them from package scripts or docs with repository-relative paths.
