import { Composition } from 'remotion'
import { DURATION, FPS, H, W } from './plan'
import { Race } from './Race'
import { RACE, RACE_SPEED } from './racePlan'
import { Reel } from './Reel'
import { Story } from './Story'
import { SPEED, STORY } from './storyPlan'

export function Root() {
  return (
    <>
      {/* 첫 번째 릴스: 만든 사람의 이야기(플레이 장면 없음). captions: false면 자막 없는 편집용 */}
      <Composition id="LinkleStory" component={Story} durationInFrames={Math.round((STORY.total / SPEED) * FPS)} fps={FPS} width={W} height={H} defaultProps={{ captions: true }} />
      {/* 두 번째 릴스: 같이 달리기(친구들과 방에서 겨루기). captions: false면 자막 없는 편집용 */}
      <Composition id="LinkleRace" component={Race} durationInFrames={Math.round((RACE.total / RACE_SPEED) * FPS)} fps={FPS} width={W} height={H} defaultProps={{ captions: true }} />
      {/* 게임 방법 전체를 담은 판(예전 두 번째 릴스 후보) */}
      <Composition id="LinkleReelC" component={Reel} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
    </>
  )
}
