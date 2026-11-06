<script setup lang="ts">
import { ref } from 'vue'
import Tinymce from '@/components/Tinymce/index.vue'
import SingleUpload from '@/components/Upload/singleUpload.vue'
import type { ContentTranslations, TranslationField } from '@/types/localization'

const props = defineProps<{ modelValue?: ContentTranslations; source?: object; fields: TranslationField[]; compact?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: ContentTranslations): void }>()
const opened = ref('pt')
const valueOf = (key: string) => props.modelValue?.pt?.[key] || ''
const setValue = (key: string, value: string) => emit('update:modelValue', {
  ...props.modelValue, pt: { ...props.modelValue?.pt, [key]: value },
})
const sourceOf = (key: string) => String((props.source as Record<string, unknown> | undefined)?.[key] || '').replace(/<[^>]*>/g, ' ').slice(0, 160)
</script>

<template>
  <el-collapse v-model="opened" accordion class="multilingual-fields" :class="{ compact }">
    <el-collapse-item name="pt">
      <template #title><span class="translation-title">葡萄牙语内容 <span>Português</span></span><el-tag size="small" effect="plain">{{ fields.filter(field => valueOf(field.key).trim()).length }}/{{ fields.length }}</el-tag></template>
      <p class="translation-intro">中文使用上方原有字段。以下内容用于商城葡萄牙语展示；普通文案留空时显示中文原文。人民币与巴西雷亚尔金额必须分别填写，不会自动换算；货号、库存和颜色值共用。</p>
      <el-form-item v-for="field in fields" :key="field.key" :label="field.label" class="translation-item">
        <div class="translation-input">
          <single-upload v-if="field.type === 'image'" :model-value="valueOf(field.key)" @update:model-value="setValue(field.key, $event)" />
          <tinymce v-else-if="field.type === 'html'" :model-value="valueOf(field.key)" :height="320" @update:model-value="setValue(field.key, $event)" />
          <el-input v-else :model-value="valueOf(field.key)" :type="field.type === 'textarea' ? 'textarea' : field.type === 'number' ? 'number' : 'text'" :min="field.type === 'number' ? 0 : undefined" :step="field.type === 'number' ? '0.01' : undefined" :autosize="field.type === 'textarea' ? { minRows: 2, maxRows: 8 } : undefined" :maxlength="field.maxlength" :placeholder="field.type === 'number' ? `请填写${field.label}` : `请填写${field.label}的葡萄牙语内容`" @update:model-value="setValue(field.key, $event)" />
          <p v-if="sourceOf(field.key) && field.type !== 'image'" class="source-copy">中文：{{ sourceOf(field.key) }}</p>
          <p v-if="field.hint" class="field-hint">{{ field.hint }}</p>
        </div>
      </el-form-item>
    </el-collapse-item>
  </el-collapse>
</template>

<style scoped>
.multilingual-fields { margin:24px 0; padding:0 20px; border:1px solid #dce6f2; border-radius:8px; background:#f9fbfe; }
.multilingual-fields :deep(.el-collapse-item__header),.multilingual-fields :deep(.el-collapse-item__wrap) { background:transparent; border:0; }
.translation-title { margin-right:12px; color:#244e76; font-weight:600; }
.translation-title span { margin-left:8px; color:#7c8fa3; font-size:12px; font-weight:400; }
.translation-intro { margin:2px 0 20px; color:#8a98a8; font-size:12px; line-height:1.8; }
.translation-input { width:100%; min-width:0; }
.source-copy,.field-hint { margin:6px 0 0; color:#8a98a8; font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
.field-hint { color:#56799b; }
.translation-item:last-child { margin-bottom:6px; }
.compact { margin:12px 0; padding:0 12px; }
</style>
