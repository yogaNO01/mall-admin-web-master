<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import http from '@/utils/http'
import MultilingualFields from '@/components/MultilingualFields.vue'
import Tinymce from '@/components/Tinymce/index.vue'
import type { ContentTranslations, TranslationField } from '@/types/localization'

type Content = { id: number; title?: string; name?: string; description?: string; subTitle?: string; content?: string; translations?: ContentTranslations }
const section = ref<'subject' | 'prefrenceArea'>('subject')
const rows = ref<Content[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref(false)
const draft = ref<Content>()
const fields = computed<TranslationField[]>(() => section.value === 'subject' ? [{ key:'title',label:'专题标题' },{ key:'description',label:'专题描述',type:'textarea' },{ key:'content',label:'专题内容',type:'html' }] : [{key:'name',label:'专区名称'},{key:'subTitle',label:'专区副标题'}])
const load = async () => {
  loading.value = true; error.value = false
  try { rows.value = (await http<Content[]>({url:`/${section.value}/content/list`,method:'get'})).data }
  catch { error.value = true }
  finally { loading.value = false }
}
const edit = (row: Content) => { draft.value = JSON.parse(JSON.stringify(row)) }
const save = async () => {
  if (!draft.value) return
  if (!(section.value === 'subject' ? draft.value.title : draft.value.name)?.trim()) return ElMessage.warning('请填写中文标题或名称')
  saving.value = true
  try { await http({url:`/${section.value}/content/update/${draft.value.id}`,method:'post',data:draft.value}); draft.value=undefined; await load(); ElMessage.success('中葡内容已保存') }
  finally { saving.value = false }
}
watch(section,load)
onMounted(load)
</script>

<template>
  <div class="app-container"><el-card shadow="never">
    <h2>专题与专区内容</h2><p class="intro">填写专题、优选专区的中文及葡萄牙语展示内容。商品关联和推荐设置仍在原功能中管理。</p>
    <el-radio-group v-model="section" style="margin-bottom:24px"><el-radio-button value="subject">专题内容</el-radio-button><el-radio-button value="prefrenceArea">优选专区</el-radio-button></el-radio-group>
    <el-alert v-if="error" title="内容加载失败，请在更新后台服务后重试。" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" border><el-table-column prop="id" label="编号" width="80" /><el-table-column label="中文" min-width="240"><template #default="{row}">{{row.title || row.name}}</template></el-table-column><el-table-column label="葡萄牙语" min-width="240"><template #default="{row}">{{row.translations?.pt?.title || row.translations?.pt?.name || '未填写'}}</template></el-table-column><el-table-column label="操作" width="100"><template #default="{row}"><el-button link type="primary" @click="edit(row)">编辑内容</el-button></template></el-table-column></el-table>
  </el-card>
  <el-dialog :model-value="!!draft" title="编辑中葡内容" width="900px" @close="draft = undefined">
    <el-form v-if="draft" label-width="120px">
      <template v-if="section === 'subject'"><el-form-item label="中文标题"><el-input v-model="draft.title" /></el-form-item><el-form-item label="中文描述"><el-input v-model="draft.description" type="textarea" /></el-form-item><el-form-item label="中文内容"><tinymce :model-value="draft.content || ''" @update:model-value="draft.content = $event" :height="320" /></el-form-item></template>
      <template v-else><el-form-item label="中文名称"><el-input v-model="draft.name" /></el-form-item><el-form-item label="中文副标题"><el-input v-model="draft.subTitle" /></el-form-item></template>
      <multilingual-fields v-model="draft.translations" :source="draft" :fields="fields" />
    </el-form>
    <template #footer><el-button @click="draft = undefined">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
  </el-dialog></div>
</template>

<style scoped>.intro { margin-bottom:24px; color:#8492a3; font-size:13px; line-height:1.8; }</style>
