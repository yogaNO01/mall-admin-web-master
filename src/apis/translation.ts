import http from '@/utils/http'

export function autoTranslateAPI(data: { text: string; sourceLang?: string; targetLangs?: string[] }) {
  return http<{ en?: string; pt?: string; es?: string }>({
    url: '/translation/auto', method: 'post', data, timeout: 100000,
  })
}
