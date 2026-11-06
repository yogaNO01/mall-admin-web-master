<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import http from '@/utils/http'

type StorefrontText = { code: string; source: string; zh: string; pt: string }
const rows = ref<StorefrontText[]>([])
const loading = ref(false)
const error = ref(false)
const keyword = ref('')
const onlyMissing = ref(false)
const page = ref(1)
const draft = ref<StorefrontText>()
const saving = ref(false)
const visibleRows = computed(() => rows.value.filter(row => (!onlyMissing.value || !row.pt?.trim()) && `${row.source} ${row.zh} ${row.pt}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())))
const load = async () => {
  loading.value = true; error.value = false
  try { rows.value = (await http<StorefrontText[]>({ url: '/home/advertise/translations/list', method: 'get' })).data }
  catch { error.value = true }
  finally { loading.value = false }
}
const save = async () => {
  if (!draft.value?.zh.trim()) return ElMessage.warning('请填写中文内容')
  saving.value = true
  try {
    await http({ url: `/home/advertise/translations/update/${draft.value.code}`, method: 'post', data: draft.value })
    const index = rows.value.findIndex(row => row.code === draft.value?.code)
    if (index >= 0) rows.value[index] = { ...draft.value }
    draft.value = undefined; ElMessage.success('中葡文案已保存，商城刷新后生效')
  } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <h2>商城中葡文案</h2>
      <p class="intro">管理导航、搜索、筛选、首页介绍、服务保障、关于我们、购买流程和常见问题等内容。商品、品牌、分类及规格的翻译在各自编辑页填写。“中国广州商品进出口贸易总会”固定保留中文。</p>
      <div class="copy-tools"><el-input v-model="keyword" placeholder="搜索中文或葡萄牙语内容" clearable @input="page = 1" /><el-checkbox v-model="onlyMissing" @change="page = 1">只看未填写葡萄牙语</el-checkbox><el-button @click="load">刷新</el-button></div>
      <el-alert v-if="error" type="error" title="文案加载失败，请确认后台服务已更新并执行多语言数据库迁移后重试。" :closable="false" />
      <el-table v-loading="loading" :data="visibleRows.slice((page - 1) * 20, page * 20)" border>
        <el-table-column prop="zh" label="中文" min-width="280" show-overflow-tooltip />
        <el-table-column prop="pt" label="葡萄牙语 · Português" min-width="320" show-overflow-tooltip />
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" @click="draft = { ...row }">编辑</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="20" :total="visibleRows.length" layout="total, prev, pager, next" />
    </el-card>
    <el-dialog :model-value="!!draft" title="编辑商城文案" width="700px" @close="draft = undefined">
      <el-form v-if="draft" label-position="top">
        <el-form-item label="中文"><el-input v-model="draft.zh" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" maxlength="20000" /></el-form-item>
        <el-form-item label="葡萄牙语 · Português"><el-input v-model="draft.pt" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" maxlength="20000" /></el-form-item>
        <p class="intro">文案中的 {count}、{keyword} 等占位符请保持完整。葡萄牙语留空时使用系统默认翻译。</p>
      </el-form>
      <template #footer><el-button @click="draft = undefined">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.intro { color:#8492a3; font-size:13px; line-height:1.8; }
.copy-tools { display:flex; align-items:center; gap:20px; margin:24px 0; }
.copy-tools .el-input { max-width:420px; }
.el-pagination { justify-content:flex-end; margin-top:24px; }
</style>
