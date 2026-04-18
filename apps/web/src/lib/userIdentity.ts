// Persistent anonymous identity for a single player on this device.
// `linkleLocalData` replaces it on a new challenge day; the identity itself
// is long-lived across days.

const KEY_USER_ID = 'linkle:userId';
const KEY_NICKNAME = 'linkle:nickname';

const ADJECTIVES = [
  '살금살금',
  '두근두근',
  '반짝이는',
  '호기심많은',
  '잽싼',
  '느긋한',
  '푸짐한',
  '쫀득한',
  '말랑한',
  '새초롬한',
  '장난꾸러기',
  '당돌한',
  '우직한',
  '명랑한',
  '단단한',
] as const;

const ANIMALS = [
  '수달',
  '곰',
  '너구리',
  '고양이',
  '팬더',
  '여우',
  '토끼',
  '햄스터',
  '다람쥐',
  '펭귄',
  '문어',
  '돌고래',
  '올빼미',
  '고슴도치',
  '고라니',
] as const;

function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a as string} ${b as string}`;
}

function randomUserId(): string {
  const rand = crypto.randomUUID().replaceAll('-', '');
  return `u_${rand.slice(0, 16)}`;
}

export function getOrCreateIdentity(): { userId: string; nickname: string } {
  let userId = localStorage.getItem(KEY_USER_ID);
  let nickname = localStorage.getItem(KEY_NICKNAME);
  if (!userId) {
    userId = randomUserId();
    localStorage.setItem(KEY_USER_ID, userId);
  }
  if (!nickname) {
    nickname = randomNickname();
    localStorage.setItem(KEY_NICKNAME, nickname);
  }
  return { userId, nickname };
}

export function setNickname(next: string): void {
  const trimmed = next.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return;
  localStorage.setItem(KEY_NICKNAME, trimmed);
}
