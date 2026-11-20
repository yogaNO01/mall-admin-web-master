<script setup lang="ts">
import { reactive, onBeforeUnmount, watch } from 'vue'
import Tinymce from '@/components/Tinymce/index.vue'
import SingleUpload from '@/components/Upload/singleUpload.vue'
import type { ContentTranslations, TranslationField } from '@/types/localization'
import { autoTranslateAPI } from '@/apis/translation'
import { ElMessage } from 'element-plus'

const props = defineProps<{ modelValue?: ContentTranslations; source?: object; fields: TranslationField[]; compact?: boolean; showChinese?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: ContentTranslations): void }>()
const detailUploadPurpose = (field: string) => {
  if (field === 'detailHtml') return 'product-detail-pc'
  if (field === 'detailMobileHtml') return 'product-detail-h5'
  return 'content-image'
}
const translating = reactive<Record<string, boolean>>({})
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
const valueOf = (language: 'en' | 'pt' | 'es', key: string) => props.modelValue?.[language]?.[key] || ''
const setValue = (language: 'en' | 'pt' | 'es', key: string, value: string) => emit('update:modelValue', {
  ...props.modelValue, [language]: { ...props.modelValue?.[language], [key]: value },
})
const sourceOf = (key: string) => String((props.source as Record<string, unknown> | undefined)?.[key] || '')
const setChinese = (key: string, value: string) => {
  if (props.source) (props.source as Record<string, unknown>)[key] = value
}
const plainSource = (key: string) => sourceOf(key).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const hasContent = (value: unknown) => String(value || '').replace(/<[^>]*>/g, ' ').trim().length > 0
const translate = async (field: TranslationField, target?: 'en' | 'pt' | 'es', force = false) => {
  const text = plainSource(field.key)
  if (!text || field.type === 'image' || field.type === 'number') return ElMessage.warning('请先填写中文文本字段')
  const targets = target ? [target] : (['en', 'pt', 'es'] as const).filter(language => force || !hasContent(valueOf(language, field.key)))
  if (!targets.length) return
  const loadingKey = target ? `${field.key}-${target}` : field.key
  translating[loadingKey] = true
  const before = { en: valueOf('en', field.key), pt: valueOf('pt', field.key), es: valueOf('es', field.key) }
  try {
    const result = await autoTranslateAPI({ text, targetLangs: targets })
    if (plainSource(field.key) !== text) return
    const next = { ...props.modelValue }
    targets.forEach(language => {
      // Never overwrite text that was entered while the request was in flight.
      if (valueOf(language, field.key) === before[language] && (force || !hasContent(valueOf(language, field.key)))) {
        next[language] = { ...next[language], [field.key]: result.data[language] || '' }
      }
    })
    emit('update:modelValue', next)
    ElMessage.success('翻译已填充，可继续修改')
  } catch {
    // Request errors are displayed by the shared client; manual editing stays available.
  } finally {
    translating[loadingKey] = false
  }
}
const scheduleTranslate = (field: TranslationField) => {
  if (field.type === 'image' || field.type === 'number') return
  clearTimeout(timers[field.key])
  timers[field.key] = setTimeout(() => translate(field, undefined, true), 900)
}
props.fields.forEach(field => {
  watch(() => [props.source, (props.source as Record<string, unknown> | undefined)?.[field.key]] as const, ([source, value], [previousSource, previous]) => {
    if (source !== previousSource) { clearTimeout(timers[field.key]); return }
    if (value && value !== previous && String(value).replace(/<[^>]*>/g, '').trim()) scheduleTranslate(field)
  })
})
onBeforeUnmount(() => Object.values(timers).forEach(timer => clearTimeout(timer)))
</script>

<template>
  <div class="multilingual-fields" :class="{ compact }">
    <div v-for="field in fields" :key="field.key" class="translation-item">
      <div v-if="showChinese !== false" class="field-label">{{ field.label }} <span v-if="field.hint">{{ field.hint }}</span></div>
      <div v-if="showChinese !== false" class="language-row zh-row"><span class="language-label">中文</span><div class="translation-input">
        <single-upload purpose="marketing-banner" v-if="field.type === 'image'" :model-value="sourceOf(field.key)" @update:model-value="setChinese(field.key, $event)" />
        <tinymce :purpose="detailUploadPurpose(field.key)" v-else-if="field.type === 'html'" :model-value="sourceOf(field.key)" :height="260" @update:model-value="setChinese(field.key, $event)" />
        <el-input v-else :model-value="sourceOf(field.key)" :type="field.type === 'textarea' ? 'textarea' : field.type === 'number' ? 'number' : 'text'" :autosize="field.type === 'textarea' ? { minRows: 2, maxRows: 8 } : undefined" :maxlength="field.maxlength" @update:model-value="setChinese(field.key, $event)" />
      </div></div>
      <div v-if="field.type === 'html'" class="html-language-heading">英文详情（EN）</div>
      <div class="language-row" :class="{ 'html-language-row': field.type === 'html' }"><span v-if="field.type !== 'html'" class="language-label">EN</span><div class="translation-input">
        <tinymce :purpose="detailUploadPurpose(field.key)" v-if="field.type === 'html'" :model-value="valueOf('en', field.key)" :height="260" @update:model-value="setValue('en', field.key, $event)" />
        <single-upload purpose="marketing-banner" v-else-if="field.type === 'image'" :model-value="valueOf('en', field.key)" @update:model-value="setValue('en', field.key, $event)" />
        <el-input v-else :model-value="valueOf('en', field.key)" :type="field.type === 'textarea' ? 'textarea' : 'text'" :autosize="field.type === 'textarea' ? { minRows: 2, maxRows: 8 } : undefined" :maxlength="field.maxlength" @update:model-value="setValue('en', field.key, $event)" />
      </div><el-button v-if="field.type !== 'image' && field.type !== 'number'" class="translate-button" size="small" :loading="translating[`${field.key}-en`]" @click="translate(field, 'en', true)">翻译</el-button></div>
      <div v-if="field.type === 'html'" class="html-language-heading">葡语详情（PT）</div>
      <div class="language-row" :class="{ 'html-language-row': field.type === 'html' }"><span v-if="field.type !== 'html'" class="language-label">PT</span><div class="translation-input">
        <tinymce :purpose="detailUploadPurpose(field.key)" v-if="field.type === 'html'" :model-value="valueOf('pt', field.key)" :height="260" @update:model-value="setValue('pt', field.key, $event)" />
        <single-upload purpose="marketing-banner" v-else-if="field.type === 'image'" :model-value="valueOf('pt', field.key)" @update:model-value="setValue('pt', field.key, $event)" />
        <el-input v-else :model-value="valueOf('pt', field.key)" :type="field.type === 'textarea' ? 'textarea' : 'text'" :autosize="field.type === 'textarea' ? { minRows: 2, maxRows: 8 } : undefined" :maxlength="field.maxlength" @update:model-value="setValue('pt', field.key, $event)" />
      </div><el-button v-if="field.type !== 'image' && field.type !== 'number'" class="translate-button" size="small" :loading="translating[`${field.key}-pt`]" @click="translate(field, 'pt', true)">翻译</el-button></div>
      <div v-if="field.type === 'html'" class="html-language-heading">西语详情（ES）</div>
      <div class="language-row" :class="{ 'html-language-row': field.type === 'html' }"><span v-if="field.type !== 'html'" class="language-label">ES</span><div class="translation-input">
        <tinymce :purpose="detailUploadPurpose(field.key)" v-if="field.type === 'html'" :model-value="valueOf('es', field.key)" :height="260" @update:model-value="setValue('es', field.key, $event)" />
        <single-upload purpose="marketing-banner" v-else-if="field.type === 'image'" :model-value="valueOf('es', field.key)" @update:model-value="setValue('es', field.key, $event)" />
        <el-input v-else :model-value="valueOf('es', field.key)" :type="field.type === 'textarea' ? 'textarea' : 'text'" :autosize="field.type === 'textarea' ? { minRows: 2, maxRows: 8 } : undefined" :maxlength="field.maxlength" @update:model-value="setValue('es', field.key, $event)" />
      </div><el-button v-if="field.type !== 'image' && field.type !== 'number'" class="translate-button" size="small" :loading="translating[`${field.key}-es`]" @click="translate(field, 'es', true)">翻译</el-button></div>
      <span v-if="translating[field.key]" class="translation-status">正在自动翻译空白语言…</span>
    </div>
  </div>
</template>

<style scoped>
.multilingual-fields { width:100%; flex-basis:100%; min-width:0; margin:0; padding:0; border:0; background:transparent; }
.translation-item { padding:0; }
.field-label { margin-bottom:10px; color:#244e76; font-weight:600; }
.field-label span { margin-left:8px; color:#8a98a8; font-size:12px; font-weight:400; }
.language-row { position:relative; display:flex; align-items:flex-start; margin:8px 0 0; }
.language-label { position:absolute; z-index:1; left:10px; top:0; line-height:32px; color:#8a98a8; font-size:12px; pointer-events:none; }
.translation-input { flex:1; min-width:0; width:100%; }
.translate-button { flex:0 0 auto; margin-left:8px; }
.translation-input :deep(.el-input__wrapper) { padding-left:40px; }
.translation-input :deep(.el-textarea__inner) { padding-left:40px; }
.translation-status { display:block; margin:4px 0 0; color:#8a98a8; font-size:12px; }
.html-language-heading { margin:24px 0 8px; color:#244e76; font-weight:600; }
.html-language-row { margin-top:0; }
.compact { margin:12px 0; padding:0 12px; }
</style>
