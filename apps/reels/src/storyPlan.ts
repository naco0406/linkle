// 이야기판(플레이 장면 없는 첫 번째 릴스)의 시간표와, 편집에서 넣을 자막의 자리.
// 영상에는 자막을 넣지 않는다. 자막은 record/srt.ts가 이 표로 SRT 파일을 만든다.
// 이 파일은 다른 모듈을 가져오지 않는다(node로 바로 읽을 수 있게).

/** 재생 속도. 아래 시각은 1배 기준으로 적고, 영상과 SRT는 이 값으로 나눈 시각에 놓인다 */
export const SPEED = 1.2

export const STORY = {
  chatOut: 4.3, // 꼬들·꼬맨틀 대화방이 비켜난다
  wave: 4.5, // 파도타기
  daily: 9.8, // 매일 한 문제씩 겨루기
  made: 13.2, // 링클 로고
  phoneIn: 15.5, // 폰이 올라온다: 실제 화면의 정지 장면 셋
  goalTap: 16.6, // 목표 문서 링크를 누른다
  arrive: 17.0, // 도착 화면
  shareTap: 17.8, // 결과 공유를 누른다 → "복사했어요"
  switch: 18.7, // 앱 전환: 링클 화면이 카드로 작아지고 채팅 카드로 넘어간다
  fieldTap: 20.9, // 입력 칸을 누른다
  menuTap: 21.8, // "붙여넣기"를 누른다
  sendTap: 22.9, // 보낸다
  mine: 23.05, // 내 결과 말풍선
  reply: 24.1, // 진우의 답
  end: 25.9, // 끝 화면
  total: 32.9,
}

/**
 * 자막. 줄은 \n으로 나누고, [대괄호] 안은 핵심어다(영상에서는 위키 링크처럼 흰 바탕에 파란 밑줄 글자).
 * SRT로 뽑을 때는 대괄호를 뗀다. 마지막 줄은 영상에서 자막 블록이 아니라 끝 화면의 제목으로 들어간다(endCard).
 */
export const STORY_CAPTIONS: Array<{ from: number; to: number; text: string; endCard?: boolean; namu?: boolean }> = [
  { from: 0.15, to: STORY.chatOut, text: '저는 친구들이랑\n[워들류 게임] 하면서\n노는 걸 참 좋아했는데요' },
  { from: STORY.wave + 0.1, to: STORY.daily, text: '어느 날\n[나무위키 파도타기]라는 걸 봤어요', namu: true },
  { from: STORY.daily + 0.1, to: STORY.made, text: '[매일 한 문제씩] 경쟁하면서\n플레이하면 재밌을 것 같아서' },
  { from: STORY.made + 0.1, to: STORY.phoneIn + 0.6, text: '[위키피디아]로 똑같이\n할 수 있도록 만들었어요' },
  { from: STORY.end, to: STORY.total, text: '[오늘의 문제], 아직 안 풀어봤죠?', endCard: true },
]

/** 대괄호 표시를 뗀 글자(SRT용) */
export const plain = (text: string) => text.replace(/[[\]]/g, '')
