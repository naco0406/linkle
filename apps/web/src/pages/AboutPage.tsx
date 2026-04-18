import type { JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle, PageShell } from '@linkle/design-system';

export function AboutPage(): JSX.Element {
  return (
    <PageShell>
      <header>
        <h1 className="text-foreground font-serif text-3xl">Linkle</h1>
        <p className="text-muted-foreground text-sm">매일 위키피디아 파도타기</p>
      </header>
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
    </PageShell>
  );
}
