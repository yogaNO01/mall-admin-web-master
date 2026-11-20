<script setup lang="ts">
import { ref, watch } from 'vue'
import http from '@/utils/http'
import { Plus } from '@element-plus/icons-vue'
import {
  ElMessage,
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
const handleUploadSuccess: UploadProps['onSuccess'] = (res, file, files) => {
  if (res?.code !== 200 || !res.data?.url) {
    file.status = 'fail'
    ElMessage({
      message: res?.message || '文件上传失败',
      type: 'error',
      duration: 3 * 1000,
    })
    return
  }
  const url: string = res.data.url
  file.url = url
  emitInput(savedUrls(files))
}
</script>

<template>
  <div>
    <el-upload
      :before-upload="file => {
        if (file.size <= 2 * 1024 * 1024) return true
        ElMessage.error('单张图片不能超过 2 MB')
        return false
      }"
      :http-request="uploadRequest"
      :on-error="() => ElMessage.error('图片上传请求失败')"
      list-type="picture-card"
      v-model:file-list="fileList"
      :limit="maxCount"
      :on-remove="handleRemove"
      :on-success="handleUploadSuccess"
      :on-preview="handlePreview"
    >
      <el-icon>
        <Plus />
      </el-icon>
    </el-upload>
    <el-dialog v-model="dialogVisible">
      <img :src="dialogImageUrl" alt="" />
    </el-dialog>
  </div>
</template>

<style></style>
