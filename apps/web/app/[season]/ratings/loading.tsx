import BoardSkeleton from '@/app/board-skeleton';
import { RATING_COLUMNS } from '@/app/table-skeleton';

export default function RatingsLoading() {
  return (
    <BoardSkeleton
      title="Ratings"
      lede="Glicko-2 rating adjusted for deviation."
      metas={['13.5rem', '9.5rem', '9rem', '7rem']}
      search="Search debater or school"
      columns={RATING_COLUMNS}
    />
  );
}
