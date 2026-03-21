# Summer Seed Script - Usage

Script: `scripts/summer-seed-api.ps1`

## Purpose
Creates randomized summer booking requests through API, then exports capacity reports before/after.

## Run
```powershell
cd D:\Repo\Connect
.\scripts\summer-seed-api.ps1 -ApiBaseUrl "http://localhost:8888" -SeasonYear 2026 -TotalRequests 120
```

## Output
Folder under `seed-output/`:
- `capacity_before.csv`
- `capacity_after.csv`
- `capacity_delta.csv`
- `created_requests.csv`
- `failed_requests.csv`
- `summary.json`

## Notes
- Uses `api/LocalAuth/DevLogin` for auth in test environment.
- Sends requests through dynamic endpoint `api/DynamicForm/CreateRequest`.
- Categories used:
  - 147 (مرسى مطروح)
  - 148 (رأس البر)
  - 149 (بور فؤاد)
- Validates against live capacity and existing duplicate constraints.
