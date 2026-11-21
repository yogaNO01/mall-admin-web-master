<script setup lang="ts">
import { ref, watch } from 'vue'
import { Delete, Refresh } from '@element-plus/icons-vue'
import http from '@/utils/http'
import {
  ElMessage,
  type UploadProps,
  type UploadRequestOptions,
  type UploadUserFile,
} from 'element-plus'

// 定义属性
const props = defineProps({
  purpose: { type: String, required: true },
  compact: Boolean,
  // 上传图片路径（Vue 3中v-model对应的属性值为modelValue）
  modelValue: {
    type: String,
    default: '',
  },
})

// 定义事件
const emit = defineEmits(['update:modelValue'])

// 控制图片预览框的显示隐藏
const dialogVisible = ref(false)
// 上传文件列表
const fileList = ref<UploadUserFile[]>([])

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

// 由于图片url是动态加载的，所以需要使用watch来监听
watch(
  () => props.modelValue,
  newVal => {
    if (newVal) {
      const fileName = newVal.substring(newVal.lastIndexOf('/') + 1)
      fileList.value = [
        {
          name: fileName,
          url: newVal,
        },
      ]
    } else {
      fileList.value = []
    }
  },
  { immediate: true },
)

// 处理input事件
const emitInput = (val: string) => {
  emit('update:modelValue', val)
}

// 处理图片删除
const handleRemove: UploadProps['onRemove'] = () => {
  emitInput('')
}

// 处理图片预览
const handlePreview: UploadProps['onPreview'] = () => {
  dialogVisible.value = true
}

// 处理图片上传成功
const handleUploadSuccess: UploadProps['onSuccess'] = (res) => {
  if (res?.code !== 200 || !res.data?.url) {
    ElMessage({
      message: res?.message || '文件上传失败',
      type: 'error',
      duration: 3 * 1000,
    })
    return
  }
  const url: string = res.data.url
  emitInput(url)
}
</script>

<template>
  <div class="single-image-upload" :class="{ 'is-compact': compact, 'has-cover': compact && modelValue }">
    <button v-if="compact && modelValue" type="button" class="compact-preview"
      aria-label="预览图片" @click="dialogVisible = true">
      <img :src="modelValue" alt="" />
    </button>
    <el-upload
      :class="{ 'cover-replace': compact && modelValue }"
      :before-upload="file => {
        if (file.size <= 2 * 1024 * 1024) return true
        ElMessage.error('单张图片不能超过 2 MB')
        return false
      }"
      :http-request="uploadRequest"
      :on-error="() => ElMessage.error('图片上传请求失败')"
      list-type="picture"
      :multiple="false"
      :show-file-list="!compact && !!modelValue"
      :file-list="fileList"
      :on-remove="handleRemove"
      :on-success="handleUploadSuccess"
      :on-preview="handlePreview"
    >
      <el-button v-if="compact && modelValue" class="cover-action" :icon="Refresh" circle
        aria-label="更换图片" title="更换图片" />
      <el-button v-else size="small" type="primary">
        {{ compact ? '上传图片' : '点击上传' }}
      </el-button>
      <template v-if="!compact" #tip>
        <div class="el-upload__tip">支持 JPG、PNG、GIF，单张最大 2 MB</div>
      </template>
    </el-upload>
    <el-button v-if="compact && modelValue" class="cover-action cover-remove" :icon="Delete" circle
      aria-label="移除图片" title="移除图片" @click="emitInput('')" />
    <el-dialog v-model="dialogVisible" append-to-body>
      <img width="100%" :src="fileList[0]?.url" alt="" />
    </el-dialog>
  </div>
</template>

<style scoped>
.is-compact { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.has-cover { display: inline-flex; position: relative; }
.has-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: rgb(0 0 0 / 38%);
  opacity: 0;
  pointer-events: none;
}
.cover-replace, .cover-remove {
  position: absolute;
  z-index: 1;
  top: 50%;
  opacity: 0;
  pointer-events: none;
}
.cover-replace { right: calc(50% + 2px); transform: translateY(-50%); line-height: 0; }
.cover-remove { left: calc(50% + 2px); transform: translateY(-50%); margin: 0; }
.has-cover:hover::after, .has-cover:focus-within::after,
.has-cover:hover .cover-replace, .has-cover:focus-within .cover-replace,
.has-cover:hover .cover-remove, .has-cover:focus-within .cover-remove { opacity: 1; }
.has-cover:hover .cover-replace, .has-cover:focus-within .cover-replace,
.has-cover:hover .cover-remove, .has-cover:focus-within .cover-remove { pointer-events: auto; }
.cover-action { width: 24px; height: 24px; padding: 0; }
@media (hover: none) {
  .has-cover::after, .has-cover .cover-replace, .has-cover .cover-remove { opacity: 1; pointer-events: auto; }
  .has-cover::after { pointer-events: none; }
}
.compact-preview {
  width: 56px;
  height: 56px;
  padding: 3px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  cursor: zoom-in;
}
.compact-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }

.single-image-upload :deep(.el-upload-list__item-name) {
  display: none;
}

.single-image-upload :deep(.el-upload-list--picture) {
  width: 112px;
}

.single-image-upload :deep(.el-upload-list--picture .el-upload-list__item) {
  width: 112px;
  height: 112px;
  padding: 8px;
}

.single-image-upload :deep(.el-upload-list__item-thumbnail) {
  width: 94px;
  height: 94px;
  margin-left: 0;
  object-fit: contain;
}
</style>
