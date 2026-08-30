import BoardSkeleton from '@/app/board-skeleton';
import { DEBATER_COLUMNS } from '@/app/table-skeleton';

export default function DebatersLoading() {
  return (
    <BoardSkeleton
      title="Debaters"
      metas={['7.5rem', '15rem']}
      search="Search debaters or schools"
      columns={DEBATER_COLUMNS}
    />
  );
}
