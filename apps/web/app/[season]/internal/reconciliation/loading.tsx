import LoadingBar from '@/app/loading-bar';

/**
 * The reconciliation keeps a boundary of its own.
 *
 * The boards dropped theirs so a click leaves the current table up, which works
 * because each board renders its heading outside a Suspense of its own. This
 * page is internal and has no such split, so without this a cold load would show
 * nothing at all until every diagnostic had been read.
 */
export default function ReconciliationLoading() {
  return <LoadingBar label="Loading the reconciliation" />;
}
