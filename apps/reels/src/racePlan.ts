// 두 번째 릴스(같이 달리기)의 시간표와 자막. 첫 번째 릴스(storyPlan.ts)와 같은 규칙이다:
// 시각은 1배 기준, 영상과 SRT는 SPEED로 나눈다. 자막의 [대괄호]는 핵심어, \n은 줄바꿈.
// 이 파일은 다른 모듈을 가져오지 않는다(node로 바로 읽을 수 있게).

export const RACE_SPEED = 1.2

export const RACE = {
  community: 0, // 커뮤니티: 방 만들기
  makeTap: 1.9,
  lobbySolo: 2.4, // QR과 방 코드
  linkTap: 3.8, // 링크 보내기
  switch: 4.4, // 앱 전환 → 단톡방
  invite: 6.4, // 내 초대 링크 말풍선
  replies: [7.0, 7.5, 8.0], // 동휘, 민서, 진우
  back: 8.7, // 다시 링클로(옆으로 밀어 넘긴다)
  lobbies: [8.7, 9.5, 10.25, 11.0], // 2명(돌아오는 순간부터), 3명, 4명, 모두 준비
  goTap: 11.8, // 출발
  reveal: 12.1, // 룰렛(이 구간만 녹화 영상)
  revealFrom: 0.3, // 녹화의 몇 초부터
  revealTo: 9.3, // 몇 초까지
  revealRate: 1.4,
  race: [18.55, 19.9, 22.3], // 달리기 세 장면
  raceTaps: [19.5, 21.9, 23.1],
  zoom: [20.0, 21.6], // 레이스 바를 크게 보는 구간
  results: 23.4, // 결과: 내가 먼저 도착
  end: 25.8, // 끝 화면
  total: 31.8,
}

export const RACE_CAPTIONS: Array<{ from: number; to: number; text: string; top?: boolean; endCard?: boolean }> = [
  { from: 0.15, to: RACE.lobbySolo - 0.05, text: '친구들이랑 [실시간]으로\n겨룰 수도 있어요' },
  { from: RACE.lobbySolo + 0.1, to: RACE.switch, text: '방을 만들고\n[링크]로 친구를 불러요' },
  { from: RACE.invite - 0.2, to: RACE.back, text: '단톡방에 보내면\n친구들이 [바로 들어와요]', top: true },
  { from: RACE.lobbies[0]!, to: RACE.goTap + 0.1, text: '최대 [8명]까지\n같이 달릴 수 있어요' },
  { from: RACE.reveal + 0.1, to: RACE.reveal + 3.3, text: '출발과 목표는\n[룰렛]으로 정해져요' },
  { from: RACE.reveal + 3.4, to: RACE.race[0]! - 0.05, text: '모두 [같은 순간]에 출발해요' },
  { from: RACE.race[0]!, to: RACE.race[1]! - 0.05, text: '[링크]만 눌러서 목표 문서까지' },
  { from: RACE.race[1]!, to: RACE.race[2]! - 0.1, text: '친구가 몇 번 움직였는지,\n[얼마나 가까운지] 보여요' },
  { from: RACE.race[2]!, to: RACE.end, text: '[먼저 도착]하면 이겨요' },
  { from: RACE.end, to: RACE.total, text: '친구들이랑 [한 판] 어때요?', endCard: true },
]
