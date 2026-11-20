// 위키백과 글의 출처 표기(CC BY-SA 4.0). 게임 화면, 도착 화면, 정보 화면이 같은 주소를 쓴다.

export const CC_BY_SA = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ko' }

/** 한국어 위키백과 원문 주소. 기여자 목록은 원문의 "역사" 탭에 있다 */
export const wikiUrl = (title: string) => `https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`
