import type { JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle, SubPageHeader } from '@linkle/design-system';

export function AboutPage(): JSX.Element {
  return (
    <>
      <SubPageHeader title="Linkle 소개" subtitle="매일 위키피디아 파도타기" />
      <main className="max-w-shell mx-auto flex w-full flex-col gap-4 px-4 py-6 md:px-6">
        <Card>
          <CardHeader>
            <CardTitle>규칙</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              <li>
                매일 바뀌는 <strong>출발 페이지 → 도착 페이지</strong> 가 주어집니다.
              </li>
              <li>본문 안의 하이퍼링크만 눌러 도착 페이지까지 이동하세요.</li>
              <li>
                외부 검색, 브라우저 <kbd className="bg-muted rounded px-1">Ctrl/⌘ + F</kbd> 사용은
                금지입니다.
              </li>
              <li>뒤로가기도 한 번의 이동으로 계산돼요.</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
