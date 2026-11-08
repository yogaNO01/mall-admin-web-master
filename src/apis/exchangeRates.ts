import axios from 'axios'
import type { CommonResult } from '@/types/common'

export type ExchangeRateResponse = {
  base: string
  rates: { CNY: number; USD: number; EUR: number }
  date?: string
  source?: string
  stale?: boolean
}

export function getExchangeRatesAPI() {
  // 汇率接口属于商城门户服务（本地默认 8085），不是后台管理服务 8080。
  const portalBase = (import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:8085').replace(/\/$/, '')
  return axios.get<CommonResult<ExchangeRateResponse>>(`${portalBase}/home/exchange-rates`, { timeout: 15000 })
    .then(({ data }) => {
      if (data.code !== 200) throw new Error(data.message || '汇率暂不可用')
      return data
    })
}
