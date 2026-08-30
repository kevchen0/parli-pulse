import BoardSkeleton from '@/app/board-skeleton';
import { SCHOOL_COLUMNS } from '@/app/table-skeleton';

export default function SchoolsLoading() {
  return (
    <BoardSkeleton
      title="Schools"
      metas={['11rem', '16rem']}
      search="Search schools or regions"
      columns={SCHOOL_COLUMNS}
    />
  );
}
