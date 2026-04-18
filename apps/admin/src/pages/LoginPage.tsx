import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@linkle/design-system';
import { ApiError, login } from '../lib/api.js';

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="bg-background grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Linkle 관리자 로그인</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setSubmitting(true);
              void login(username, password)
                .then(() => navigate('/', { replace: true }))
                .catch((err: unknown) => {
                  if (err instanceof ApiError) {
                    setError(
                      err.status === 401
                        ? '아이디 또는 비밀번호가 올바르지 않습니다.'
                        : err.message,
                    );
                  } else {
                    setError('로그인에 실패했습니다.');
                  }
                })
                .finally(() => {
                  setSubmitting(false);
                });
            }}
          >
            <label className="flex flex-col gap-1 text-sm" htmlFor="admin-username">
              <span>아이디</span>
              <Input
                id="admin-username"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.currentTarget.value);
                }}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" htmlFor="admin-password">
              <span>비밀번호</span>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.currentTarget.value);
                }}
                required
              />
            </label>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? '확인 중…' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
