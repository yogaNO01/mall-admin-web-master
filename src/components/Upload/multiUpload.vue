<script setup lang="ts">
import { ref, watch } from 'vue'
import http from '@/utils/http'
import { Plus } from '@element-plus/icons-vue'
import {
  ElMessage,
  type UploadInstance,
  type UploadProps,
  type UploadRequestOptions,
  type UploadUserFile,
} from 'element-plus'

// 定义属性
const props = defineProps({
  purpose: { type: String, required: true },
  // 上传图片路径（Vue 3中v-model对应的属性值为modelValue）
  modelValue: {
    type: Array<string>,
    default: [],
  },
  //最大上传图片数量
  maxCount: {
    type: Number,
    default: 5,
  },
})

// 定义事件
const emit = defineEmits(['update:modelValue'])

// 控制图片预览框的显示隐藏
const dialogVisible = ref(false)
// 上传文件列表
const fileList = ref<UploadUserFile[]>([])
const uploadRef = ref<UploadInstance>()

const uploadRequest = ({ file, onProgress }: UploadRequestOptions) => {
  const formData = new FormData()
  formData.append('purpose', props.purpose)
  formData.append('file', file)
  return http.post('/media/upload', formData, {
    timeout: 60_000,
    onUploadProgress: event => {
      if (event.total) onProgress({ percent: event.loaded / event.total * 100 } as ProgressEvent & { percent: number })
    },
  })
}
const savedUrls = (files: UploadUserFile[]) => files.flatMap(file =>
  file.status === 'success' && file.url ? [file.url] : [],
)
// 弹框中的图片路径
const dialogImageUrl = ref('')

// 由于图片url是动态加载的，所以需要使用watch来监听
watch(
  () => props.modelValue,
  newVal => {
    const current = savedUrls(fileList.value)
    if (newVal.length === current.length && newVal.every((url, index) => url === current[index])) return
    if (newVal) {
      fileList.value = newVal.map(item => {
        const fileName = item.substring(item.lastIndexOf('/') + 1)
        return {
          name: fileName,
          url: item,
          status: 'success',
        }
      })
    } else {
      fileList.value = []
    }
  },
  { immediate: true },
)

// 处理input事件
const emitInput = (val: string[]) => {
  emit('update:modelValue', val)
}

// 处理图片删除
const handleRemove: UploadProps['onRemove'] = (file, files) => {
  emitInput(savedUrls(files.filter(item => item.uid !== file.uid)))
}

// 处理图片预览
const handlePreview: UploadProps['onPreview'] = file => {
  dialogVisible.value = true
  dialogImageUrl.value = file.url!
}

// 处理图片上传成功
const handleUploadSuccess: UploadProps['onSuccess'] = (res, file) => {
  if (res?.code !== 200 || !res.data?.url) {
    uploadRef.value?.handleRemove(file)
    ElMessage({
      message: res?.message || '文件上传失败',
      type: 'error',
      duration: 3 * 1000,
    })
    return
  }
  const url: string = res.data.url
  const entry = fileList.value.find(item => item.uid === file.uid)
  if (!entry) return
  entry.url = url
  entry.status = 'success'
  emitInput(savedUrls(fileList.value))
}
</script>

<template>
  <div>
    <el-upload
      ref="uploadRef"
      :before-upload="file => {
        if (file.size <= 2 * 1024 * 1024) return true
        ElMessage.error('单张图片不能超过 2 MB')
        return false
      }"
      :http-request="uploadRequest"
      :on-error="() => ElMessage.error('图片上传请求失败')"
      list-type="picture-card"
      v-model:file-list="fileList"
      multiple
      :class="{ 'album-at-limit': fileList.length >= maxCount }"
      :limit="maxCount"
      :on-exceed="() => ElMessage.warning(`本次选择超过剩余名额，相册最多上传 ${maxCount} 张`)"
      :on-remove="handleRemove"
      :on-success="handleUploadSuccess"
      :on-preview="handlePreview"
    >
      <el-icon>
        <Plus />
      </el-icon>
      <template #file="{ file }">
        <div class="album-tile">
          <button type="button" class="album-preview" aria-label="预览图片"
            :disabled="!file.url" @click.stop="handlePreview(file)">
            <el-image v-if="file.url" :src="file.url" fit="cover" class="album-thumbnail">
              <template #error><span class="album-feedback">图片加载失败</span></template>
            </el-image>
            <span v-else class="album-feedback">上传中</span>
          </button>
          <el-button class="album-remove" size="small" circle aria-label="移除图片"
            @click.stop="uploadRef?.handleRemove(file)">×</el-button>
        </div>
      </template>
    </el-upload>
    <el-dialog v-model="dialogVisible" title="图片预览" width="min(840px, 90vw)" append-to-body>
      <el-image v-if="dialogVisible" :src="dialogImageUrl" fit="contain" class="album-full-image">
        <template #error><span>图片无法加载，请检查图片地址或重新上传。</span></template>
      </el-image>
    </el-dialog>
  </div>
</template>

<style scoped>
.album-at-limit :deep(.el-upload--picture-card) { display: none; }
.album-tile, .album-preview, .album-thumbnail { width: 100%; height: 100%; }
.album-tile { position: relative; }
.album-preview { display: block; padding: 0; border: 0; background: var(--el-fill-color-light); cursor: zoom-in; }
.album-feedback { display: grid; place-items: center; height: 100%; font-size: 11px; color: var(--el-text-color-secondary); }
.album-remove { position: absolute; top: 4px; right: 4px; }
.album-full-image { display: block; width: 100%; max-height: 68vh; }
.album-full-image :deep(img) { max-height: 68vh; }
</style>
