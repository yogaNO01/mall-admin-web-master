import type { ContentTranslations } from './localization'
/** 优选区域信息 */
export type CmsPrefrenceArea = {
  /** Chinese / Portuguese customer-facing content. */
  translations?: ContentTranslations
  /** ID */
  id?: number
  /** 名称 */
  name: string
  /** 副标题 */
  subTitle: string
  /** 排序 */
  sort: number
  /** 显示状态：0->不显示；1->显示 */
  showStatus: number
  /** 展示图片 */
  pic?: string
}
