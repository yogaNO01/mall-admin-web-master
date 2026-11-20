<template>
  <div class="rich-editor">
    <editor v-model="contentValue" :init="initOptions" :disabled="disabled" @onClick="onClick" @onBlur="onBlur"
      @onFocus="onFocus" tinymceScriptSrc="./tinymce6.8.6/tinymce.min.js" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Editor from '@tinymce/tinymce-vue'
import http from '@/utils/http'

interface Props {
  modelValue: string
  purpose?: string
  disabled?: boolean
  height?: number
  toolbar?: string[]
  plugins?: string[]
  placeholder?: string
}

interface BlobInfo {
  blob: () => Blob
  filename: () => string
  id: () => string
  name: () => string
  base64: () => string
}

type UploadProgressCallback = (percent: number) => void

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'click'): void
  (e: 'blur'): void
  (e: 'focus'): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  purpose: 'content-image',
  height: 400,
  toolbar: () => [
    'blocks | undo redo remove| bold italic underline strikethrough removeformat | fontselect fontsizeselect formatselect | alignleft aligncenter alignright alignjustify',
    'fontsize forecolor backcolor bullist numlist |link image table | code fullscreen'
  ],
  plugins: () => [
    'link', 'image', 'table', 'lists', 'code', 'fullscreen'
  ],
  placeholder: ''
})

const emit = defineEmits<Emits>()

const contentValue = ref(props.modelValue)

// 监听外部值变化
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== contentValue.value) {
      contentValue.value = newValue
    }
  }
)

// 监听内部值变化
watch(contentValue, (newValue) => {
  emit('update:modelValue', newValue)
})

const initOptions = {
  convert_urls: false,
  language: 'zh_CN',
  language_url: './tinymce6.8.6/langs/zh_CN.js',
  selector: '#mytextarea',
  height: props.height,
  menubar: false,
  plugins: props.plugins,
  toolbar: props.toolbar,
  placeholder: props.placeholder,
  branding: false, // 隐藏 tinyMCE 品牌标识
  resize: true, // 允许调整大小
  elementpath: false, // 隐藏底部元素路径
  content_style: `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 14px;
      margin: 10px;
      line-height: 1.6;
    }
  `,
  images_upload_handler: async (blobInfo: BlobInfo, progress: UploadProgressCallback) => {
    const file = blobInfo.blob()
    if (file.size > 2 * 1024 * 1024) throw new Error('单张图片不能超过 2 MB')
    const formData = new FormData()
    formData.append('purpose', props.purpose)
    formData.append('file', file, blobInfo.filename())
    const response = await http.post('/media/upload', formData, {
      timeout: 60_000,
      onUploadProgress: event => {
        if (event.total) progress(event.loaded / event.total * 100)
      },
    }) as unknown as { code: number; message?: string; data?: { url?: string } }
    if (response.code !== 200 || !response.data?.url) {
      throw new Error(response.message || '图片上传失败')
    }
    return response.data.url
  }
}

const onClick = () => {
  emit('click')
}

const onBlur = () => {
  emit('blur')
}

const onFocus = () => {
  emit('focus')
}
</script>

<style scoped>
.rich-editor {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

:deep(.tox-tinymce) {
  border-radius: 4px;
  border: none;
}

:deep(.tox-edit-area) {
  min-height: 300px;
}
</style>
