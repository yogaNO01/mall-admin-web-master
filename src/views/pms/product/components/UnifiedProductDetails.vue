<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Tinymce from '@/components/Tinymce/index.vue'
import { autoTranslateAPI } from '@/apis/translation'
import type { PmsProductParam } from '@/types/product'

const props = defineProps<{ product: PmsProductParam }>()
const languages = ['en', 'pt', 'es', 'it', 'fr'] as const
const language = ref<'zh' | typeof languages[number]>('zh')
const device = ref<'pc' | 'h5'>('pc')
const visible = ref(false)
const busy = ref(false)
const draft = ref<string>()
const generatedSource = ref<string>()
const cache = new Map<string, Partial<Record<typeof languages[number], string>>>()
const source = computed(() => draft.value ?? (props.product.detailHtml || props.product.detailMobileHtml || ''))
const previewHtml = computed(() => {
  const key = device.value === 'pc' ? 'detailHtml' : 'detailMobileHtml'
  if (language.value === 'zh') return draft.value ?? props.product[key] ?? ''
  return props.product.translations?.[language.value]?.[key] || ''
})
const previewDoc = computed(() => `<!doctype html><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'">
  <style>body{margin:16px;font:15px/1.65 system-ui;overflow-wrap:anywhere}
  img,video{display:block;max-width:100% !important;height:auto !important;margin-inline:auto}
  table{display:block;max-width:100%;overflow:auto}</style>
  ${previewHtml.value || '<p>此语言和设备暂无详情。</p>'}`)

function textNodes(body: HTMLElement) {
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.data.trim() && !node.parentElement?.closest('script,style,template')) nodes.push(node)
  }
  return nodes
}

async function prepare() {
  if (busy.value) return false
  if (draft.value === undefined || generatedSource.value === draft.value) return true
  busy.value = true
  const html = draft.value
  const parse = () => new DOMParser().parseFromString(html, 'text/html').body
  try {
    const texts = new Set(textNodes(parse()).map(node => node.data.trim()))
    for (const text of texts) {
      if (!/\p{L}/u.test(text)) continue
      const existing = cache.get(text) || {}
      const missing = languages.filter(lang => !existing[lang])
      if (!missing.length) continue
      const result = await autoTranslateAPI({ text, targetLangs: missing })
      const translations = { ...existing, ...result.data }
      cache.set(text, translations)
      if (missing.some(lang => !translations[lang]?.trim())) throw new Error('译文不完整')
    }
    const translations = { ...props.product.translations }
    for (const lang of languages) {
      const body = parse()
      for (const node of textNodes(body)) {
        const text = node.data.trim()
        const translated = cache.get(text)?.[lang]
        if (translated) node.data = node.data.replace(text, () => translated)
      }
      const localizedHtml = texts.size ? body.innerHTML : html
      translations[lang] = { ...translations[lang], detailHtml: localizedHtml, detailMobileHtml: localizedHtml }
    }
    props.product.detailHtml = html
    props.product.detailMobileHtml = html
    props.product.translations = translations
    generatedSource.value = html
    return true
  } catch {
    ElMessage.error('详情译文生成失败，请重试。已生成的段落会保留。')
    return false
  } finally {
    busy.value = false
  }
}

async function preview() {
  if (await prepare()) visible.value = true
}

defineExpose({ prepare })
</script>

<template>
  <div class="detail-editor">
    <p class="detail-tip">编辑一份中文详情，图片供全部语言和设备共用。预览或进入下一步时自动生成译文。</p>
    <el-select v-if="draft === undefined && product.detailHtml && product.detailMobileHtml && product.detailHtml !== product.detailMobileHtml"
      placeholder="旧商品可选择一份详情作为统一原稿"
      @change="draft = $event === 'pc' ? product.detailHtml : product.detailMobileHtml">
      <el-option label="使用原电脑端详情" value="pc" />
      <el-option label="使用原移动端详情" value="h5" />
    </el-select>
    <Tinymce purpose="product-detail-pc" :height="420" :model-value="source" :disabled="busy"
      @update:model-value="draft = $event" />
    <el-button :loading="busy" @click="preview">预览各语言详情</el-button>
    <el-dialog v-model="visible" title="商品详情预览" width="min(1024px, 95vw)" append-to-body>
      <div class="preview-controls">
        <el-radio-group v-model="language">
          <el-radio-button value="zh">中文</el-radio-button>
          <el-radio-button value="en">EN</el-radio-button>
          <el-radio-button value="pt">PT</el-radio-button>
          <el-radio-button value="es">ES</el-radio-button>
          <el-radio-button value="it">IT</el-radio-button>
          <el-radio-button value="fr">FR</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="device">
          <el-radio-button value="pc">PC</el-radio-button>
          <el-radio-button value="h5">H5</el-radio-button>
        </el-radio-group>
      </div>
      <iframe title="商品详情预览" sandbox="" :srcdoc="previewDoc" class="detail-preview"
        :class="{ 'detail-preview--mobile': device === 'h5' }" />
    </el-dialog>
  </div>
</template>

<style scoped>
.detail-editor { display: grid; gap: 12px; width: 100%; min-width: 0; }
.detail-editor > .el-button { justify-self: start; }
.detail-tip { margin: 0; color: var(--el-text-color-secondary); line-height: 1.5; }
.preview-controls { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.detail-preview { display: block; width: 100%; height: 60vh; margin: 0 auto; border: 1px solid var(--el-border-color); }
.detail-preview--mobile { max-width: 390px; }
</style>
