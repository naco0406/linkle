import { useEffect, useState, type JSX } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AutocompleteWikipediaInput,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@linkle/design-system';
import { challengeDateSchema } from '@linkle/shared';
import { deleteChallenge, listChallenges, upsertChallenge } from '../lib/api.js';

export function ChallengeEditorPage(): JSX.Element {
  const { date } = useParams<{ date: string }>();
  const parsed = challengeDateSchema.safeParse(date);
  if (!parsed.success) return <InvalidDate />;
  return <ChallengeEditor date={parsed.data} />;
}

interface ChallengeEditorProps {
  readonly date: string;
}

function ChallengeEditor({ date }: ChallengeEditorProps): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['admin', 'challenges', date, date],
    queryFn: () => listChallenges(date, date),
  });

  const existing = q.data?.find((c) => c.date === date);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  useEffect(() => {
    if (!existing) return;
    setStartPage(existing.startPage);
    setEndPage(existing.endPage);
  }, [existing]);

  const save = useMutation({
    mutationFn: () => upsertChallenge({ date, startPage, endPage }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'challenges'] });
      await navigate('/', { replace: true });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteChallenge(date),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'challenges'] });
      await navigate('/', { replace: true });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link to="/">← 대시보드</Link>
        </Button>
        <h1 className="font-serif text-2xl">{date}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>챌린지 편집</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <label className="flex flex-col gap-1 text-sm" htmlFor="start-page">
              <span>출발 페이지</span>
              <AutocompleteWikipediaInput
                id="start-page"
                value={startPage}
                onChange={setStartPage}
                placeholder="예: 대한민국"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" htmlFor="end-page">
              <span>도착 페이지</span>
              <AutocompleteWikipediaInput
                id="end-page"
                value={endPage}
                onChange={setEndPage}
                placeholder="예: 비틀즈"
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={save.isPending || startPage === '' || endPage === ''}
                block
              >
                {save.isPending ? '저장 중…' : existing ? '업데이트' : '생성'}
              </Button>
              {existing ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('정말 이 챌린지를 삭제할까요?')) {
                      remove.mutate();
                    }
                  }}
                >
                  삭제
                </Button>
              ) : null}
            </div>
            {save.error ? (
              <p role="alert" className="text-destructive text-sm">
                저장에 실패했습니다: {String(save.error)}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function InvalidDate(): JSX.Element {
  return (
    <div className="text-muted-foreground p-8 text-center text-sm">날짜 형식이 잘못되었습니다.</div>
  );
}
