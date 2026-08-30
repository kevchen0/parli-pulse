import BoardSkeleton from '@/app/board-skeleton';
import { SPEAKER_COLUMNS } from '@/app/table-skeleton';

export default function SpeakersLoading() {
  return (
    <BoardSkeleton
      title="Speaker points"
      lede="Speaker points adjusted for the judge who awarded them. Panels differ by two points or more, so a raw average depends heavily on the draw."
      metas={['12rem', '10.5rem', '7rem']}
      columns={SPEAKER_COLUMNS}
      search="Search debater or school"
    />
  );
}
