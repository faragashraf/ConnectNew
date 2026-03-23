# Text Encoding Guidelines

This repository contains Arabic UI text and must be kept UTF-8 safe.

## Rules
1. Keep source files in UTF-8.
2. Do not use shell write commands that can change encoding silently (for example `Set-Content` without explicit `-Encoding utf8`).
3. Prefer patch-based edits (`git diff` / `apply_patch`) for source files with Arabic strings.
4. Run `npm run check:text-encoding` before finalizing changes to `EmployeeRequests` module files.
5. If the check fails, fix the reported lines before building.

## Quick Validation
```bash
npm run check:text-encoding
npm run build
```
