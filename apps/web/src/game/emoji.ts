import { emojiOf, levelOf, type Level, type Run } from '@linkle/core'
import { embed, loadModel, score01, type EmbedModel, type ModelMeta } from '@linkle/embed'
import metaUrl from '@linkle/embed/model/embed-v1.json?url'
import binUrl from '@linkle/embed/model/embed-v1.bin?url'

let pending: Promise<EmbedModel> | null = null

/** 유사도 모델을 받는다. 게임을 시작할 때 미리 불러 두면 끝날 때 기다리지 않는다 */
export function getModel(): Promise<EmbedModel> {
  pending ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch(metaUrl).then(r => r.json() as Promise<ModelMeta>),
      fetch(binUrl).then(r => r.arrayBuffer()),
    ])
    return loadModel(meta, bin)
  })().catch(e => {
    pending = null
    throw e
  })
  return pending
}

/** 끝난 판의 이모지를 기기에서 계산한다. 문단이 없는 문서는 빈 칸으로 남는다 */
export async function computeEmoji(run: Run): Promise<string[]> {
  const model = await getModel()
  const endId = run.puzzle.end.id
  const targetLead = run.leads[endId]
  const target = targetLead ? embed(model, targetLead) : null
  const levels = new Map<number, Level | null>()
  return emojiOf(run.events, endId, id => {
    if (!levels.has(id)) {
      const lead = run.leads[id]
      levels.set(id, target && lead ? levelOf(score01(model, target, embed(model, lead))) : null)
    }
    return levels.get(id) ?? null
  })
}
