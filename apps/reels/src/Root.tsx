import { Composition } from 'remotion'
import { DURATION, FPS, H, W } from './plan'
import { Reel } from './Reel'
import { Story } from './Story'
import { SPEED, STORY } from './storyPlan'

export function Root() {
  return (
    <>
      {/* 첫 번째 릴스: 만든 사람의 이야기(플레이 장면 없음). captions: false면 자막 없는 편집용 */}
      <Composition id="LinkleStory" component={Story} durationInFrames={Math.round((STORY.total / SPEED) * FPS)} fps={FPS} width={W} height={H} defaultProps={{ captions: true }} />
      {/* 두 번째 릴스의 바탕: 실제 플레이까지 담은 판 */}
      <Composition id="LinkleReelC" component={Reel} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
    </>
  )
}
