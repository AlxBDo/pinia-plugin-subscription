# pinia-plugin-state-snapshots

`StateSnapshotsSubscriber` provides automatic rollback for actions configured in
`storeOptions.rollbackAfterFailure`. It saves a snapshot for each invocation,
including overlapping and nested calls, and restores that snapshot if the action
fails. A successful invocation discards its snapshot. Disposing a store releases
its pending snapshots.

Rollback restores the selected state as it was when the invocation started; it
does not merge changes made by other actions while that invocation was pending.
An empty state-key array selects the full state.