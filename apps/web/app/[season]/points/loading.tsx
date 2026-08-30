import BoardSkeleton from '@/app/board-skeleton';
import { TEAM_COLUMNS } from '@/app/table-skeleton';

/**
 * Teams, while the rows are on the way.
 *
 * `/points/debaters` and `/points/schools` sit under this segment and would
 * inherit this boundary, so each supplies its own `loading.tsx` alongside. That
 * is what lets this one name the Teams columns outright instead of falling back
 * to something true of all three.
 */
export default function TeamsLoading() {
  return (
    <BoardSkeleton
      title="Teams"
      lede="Points scored under the Article XXI rules."
      metas={['9rem', '6.5rem', '9.5rem']}
      search="Search debaters or schools"
      columns={TEAM_COLUMNS}
    />
  );
}
