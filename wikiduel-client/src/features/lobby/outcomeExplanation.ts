import type { RoundOutcome } from '@wikiduel/contracts'

export const outcomeExplanation: Record<RoundOutcome['winReason'], string> = {
  'fewer-clicks': 'Both players reached the target. Fewer clicks won.',
  'earlier-arrival': 'Both players used the same number of clicks. Earlier arrival won.',
  'sole-arrival': 'Only one player reached the target before the Time Limit.',
  'neither-arrived': 'Neither player reached the target before the Time Limit. No HP lost.',
}
