# Chat timeout and persistence

Cloudflare 524 on the Laia chat path means the origin or Worker path held the browser request open for too long while Hermes was still working.

Refresh can appear to fix the problem because the backend eventually completes or enough state gets persisted elsewhere to recover the session after a reload.

## Required fix

The dashboard must use an **async run model**:

1. Persist the user message immediately.
2. Create a durable run record and assistant placeholder immediately.
3. Return control to the browser in about 1-2 seconds.
4. Process Hermes work out of band.
5. Rehydrate pending and completed run state after refresh.

## Acceptance criteria

No dashboard chat action depends on a single HTTP request staying open for the full Hermes run.
