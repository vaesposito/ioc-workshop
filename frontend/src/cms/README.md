# Frontend CMS content

The demo frontend reads its catalog content through `cmsRepository` in `src/cms/repository.ts`.

## Content ownership

- `src/content/applications.json`: application records and descriptions.
- `src/content/investigations.json`: completed demo detections and evidence.
- `src/content/traces.json`: trace index rows shown in portfolio and trace manager views.
- `src/content/trace-content/`: conversation payloads used by trace visualizer and report views.
- `src/content/memory-status.json`: per-application technique readiness.
- `src/content/application-copy.ts`: editable application-purpose copy.
- `src/content/techniques.ts`: technique labels, descriptions, and demo availability.
- `src/content/ui-copy.ts`: page-level copy and labels.

The repository returns the existing frontend domain types, so pages do not import fixture files directly. React Query hooks use this repository for read-only demo data.

## Backend boundary

The CMS provider currently owns read-only demo content. The BFF remains responsible for authenticated mutations and live operations, including application creation, trace upload, investigation submission, reruns, verdict overrides, and WebSocket updates.

A future API-backed provider can implement the same repository methods without changing page components. Keep provider selection centralized in `src/cms/repository.ts` or a provider factory rather than adding fixture/API branches to individual pages.
