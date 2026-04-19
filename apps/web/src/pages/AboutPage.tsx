import type { JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@linkle/design-system';
import { AppShell } from '../components/AppShell.js';
import { PageTitle } from '../components/PageTitle.js';

export function AboutPage(): JSX.Element {
  return (
    <AppShell>
      <PageTitle title="소개" subtitle="매일 위키피디아 파도타기" />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>규칙</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-outside list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                매일 바뀌는 <strong>출발 페이지 → 도착 페이지</strong>가 주어집니다.
              </li>
              <li>본문 안의 하이퍼링크만 눌러 도착 페이지까지 이동하세요.</li>
              <li>뒤로가기도 한 번의 이동으로 계산돼요.</li>
              <li>
                외부 검색, 브라우저{' '}
                <kbd className="bg-muted rounded px-1 font-mono">Ctrl/⌘ + F</kbd> 사용은 금지입니다.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>유사도 이모지</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              클리어하면 경로 제목과 도착지 사이의 의미적 유사도가 이모지로 표현돼요.
            </p>
            <ul className="space-y-1 font-mono">
              <li>0.8 이상: 🟦</li>
              <li>0.6 이상 0.8 미만: 🟩</li>
              <li>0.4 이상 0.6 미만: 🟨</li>
              <li>0.2 이상 0.4 미만: 🟧</li>
              <li>0.2 미만: 🟥</li>
              <li>뒤로가기: ⏪ · 도착: 🏁</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
