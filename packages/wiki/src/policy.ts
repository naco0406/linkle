/**
 * 게임에서 보여 줄 것과 누를 수 있는 링크의 규칙.
 * 화면(브라우저)과 기록 검증(Node)이 같은 규칙을 써야 "누를 수 있었던 링크"의 정의가 하나로 유지된다.
 */
export type Policy = {
  /** 제목이 여기에 있는 섹션은 통째로 지운다 */
  dropSections: readonly string[]
  /** 해당하는 요소를 지운다 */
  dropSelectors: readonly string[]
  link: {
    /** 없는 문서로 가는 링크(빨간 링크) */
    allowMissing: boolean
    /** 동음이의 문서로 가는 링크 */
    allowDisambiguation: boolean
    /** 이 제목으로 가는 링크는 글자만 남긴다 */
    blockedTitles: readonly string[]
  }
}

export const defaultPolicy: Policy = {
  dropSections: ['같이 보기', '각주', '외부 링크', '참고 문헌', '주해', '출처', '바깥 고리', '주석', '내용주'],
  dropSelectors: [
    '.navbox', '.navbox-styles', '.hatnote', '.dablink', '.ambox', '.sistersitebox', '.metadata',
    '.mw-references-wrap', 'ol.references', 'sup.reference', '.mw-editsection', '.noprint',
    'audio', 'video', 'script', 'link', 'meta', 'base',
  ],
  link: {
    allowMissing: false,
    allowDisambiguation: true,
    blockedTitles: [],
  },
}

/** 일반 문서가 아닌 이름공간. 콜론 앞이 여기에 있으면 링크를 풀어 버린다 */
const NAMESPACES = new Set(
  [
    '특수', '틀', '분류', '파일', '그림', '미디어', '위키백과', '백', '도움말', '사용자', '토론', '포털', '들머리', '모듈',
    '미디어위키', '초안', '위키프로젝트', '책', '강좌',
    'special', 'template', 'category', 'file', 'image', 'media', 'wikipedia', 'wp', 'help', 'user', 'talk', 'portal',
    'module', 'mediawiki', 'draft',
  ].flatMap(n => [n, `${n}토론`, `${n}_토론`, `${n} 토론`, `${n} talk`, `${n}_talk`]),
)

export function isMainNamespace(title: string): boolean {
  const i = title.indexOf(':')
  if (i <= 0) return true
  return !NAMESPACES.has(title.slice(0, i).trim().toLowerCase())
}
