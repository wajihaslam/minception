# Team Workflow — Minception

## Daily Git Workflow

```bash
# Morning: sync with latest
git checkout develop
git pull origin develop

# Start feature
git checkout -b feature/your-name/what-you-are-building

# Work... commit often
git add .
git commit -m "feat(mock): add header matching [migration: 002]"

# Push and open PR → develop
git push origin feature/your-name/what-you-are-building
```

## PR Checklist

Before opening a PR, verify:
- [ ] `pytest app/tests/ -v` passes
- [ ] `npm test` passes (frontend changes)
- [ ] Migration written if schema changed
- [ ] `python -m migrations.runner --env dev --dry-run` clean
- [ ] SCHEMA-VERSIONS.md updated
- [ ] No `.env` files committed
- [ ] At least 1 reviewer assigned

## Commit Format

```
type(scope): description [migration: NNN]

Types: feat | fix | docs | chore | refactor | test
Scope: mock | admin | frontend | migrations | docker | nginx

Examples:
feat(mock): add jsonpath body matching
fix(admin): correct JWT expiry calculation [migration: 003]
docs: update team workflow
chore(deps): bump fastapi to 0.112
```

## Migration Coordination

To avoid migration number collisions, check in Slack before creating a migration:
"I'm creating migration 003 — no conflicts?"

Sequential numbering: 001, 002, 003... applied in order by the runner.

## Release Schedule

- **Monday 10am:** Freeze develop (no new PRs)
- **Monday 11am:** Deploy develop → staging (Bitbucket auto)
- **Monday-Tuesday:** QA on staging
- **Tuesday 10am:** Merge develop → main (manual)
- **Tuesday 11am:** Production deploy (manual approval in Bitbucket)

## Who Owns What

| Area | Owner |
|------|-------|
| docker-compose.prod.yml | Wajih only |
| Jenkinsfile / bitbucket-pipelines.yml | Wajih only |
| SCHEMA-VERSIONS.md | Wajih updates after deploy |
| migrations/runner.py | Code review required |
| mock-service/ | Any dev |
| admin-service/ | Any dev |
| frontend/ | Any dev |
