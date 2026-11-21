<script setup lang="ts">
import MultilingualFields from '@/components/MultilingualFields.vue'
import { ref, reactive, computed, onMounted, inject, type Ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { getProductAttributeCategoryListAPI as fetchProductAttrCateList } from '@/apis/productAttrCate'
import { getProductAttributeListAPI, getProductAttrInfoByCateIdAPI as getCategoryAttributeInfoAPI } from '@/apis/productAttr'
import { isColorSpec, parseProductColor, encodeProductColor } from '@/utils/product-colors'
import SingleUpload from '@/components/Upload/singleUpload.vue'
import type { PmsProductParam } from '@/types/product'
import type { ElSelectDataVo } from '@/types/common'
import MultiUpload from '@/components/Upload/multiUpload.vue'
import type { ProductAttrVo, ProductParamVo } from '@/types/productAttr'
import type { PmsSkuStock } from '@/types/skuStock'
import UnifiedProductDetails from './UnifiedProductDetails.vue'
import { autoTranslateAPI } from '@/apis/translation'

// 定义属性
const props = defineProps({
  isEdit: {
    type: Boolean,
    default: false
  }
})

// 定义事件
const emit = defineEmits(['prev-step', 'next-step'])

// 获取跨层传递的数据
const compProductParam = inject('product-key') as Ref<PmsProductParam>

// 模板引用
const productAttrForm = ref<FormInstance>()
const translatingColors = reactive<Record<string, boolean>>({})

// 响应式数据
const state = reactive({
  // 编辑模式时是否初始化成功
  hasEditCreated: false,
  // 商品属性分类下拉选项
  productAttributeCategoryOptions: [] as ElSelectDataVo[],
  // 选中的商品规格
  selectProductAttr: [] as ProductAttrVo[],
  // 选中的商品参数
  selectProductParam: [] as ProductParamVo[],
  // 选中的商品属性图片
  // 可手动添加的商品属性
  addProductAttrValue: '',
  addProductAttrColor: '#30486D',
})

const unifiedDetails = ref<InstanceType<typeof UnifiedProductDetails>>()

// 商品的ID
const productId = computed(() => {
  return compProductParam.value.id
})
const defaultSkuStock = ref<number | undefined>(0)
const stockPreferenceKey = computed(() => productId.value ? `mall:sku-default-stock:${productId.value}` : '')
watch(stockPreferenceKey, key => {
  defaultSkuStock.value = key ? Number(localStorage.getItem(key) || 0) : 0
}, { immediate: true })
watch(defaultSkuStock, value => {
  if (stockPreferenceKey.value && value != null && Number.isInteger(value) && value >= 0) {
    localStorage.setItem(stockPreferenceKey.value, String(value))
  }
})

const createSkuCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return 'SKU-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

// 由于compProductParam数据为异步加载，需要监听其变化来初始化数据
watch(productId, (newVal, oldVal) => {
  if (props.isEdit) {
    handleEditCreated()
  }
  console.log("attr", newVal, oldVal)
})

// 获取商品属性分类
const getProductAttrCateList = async () => {
  const param = { pageNum: 1, pageSize: 100 }
  const res = await fetchProductAttrCateList(param)
  state.productAttributeCategoryOptions = res.data.list.map(item => ({
    label: item.name,
    value: item.id!
  }))
}

onMounted(async () => {
  await getProductAttrCateList()
})

const hasColorSpec = computed(() => state.selectProductAttr.some(attr => isColorAttribute(attr)))

const colorAlbums = computed<Record<string, string[]>>(() => {
  try {
    const data: unknown = JSON.parse(compProductParam.value.translations?.zh?.colorAlbums || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter(([, urls]) =>
      Array.isArray(urls) && urls.every(url => typeof url === 'string'),
    ))
  } catch {
    return {}
  }
})

const saveColorAlbums = (albums: Record<string, string[]>) => {
  const translations = compProductParam.value.translations
  compProductParam.value.translations = {
    ...translations,
    zh: { ...translations?.zh, colorAlbums: JSON.stringify(albums) },
  }
}

const setColorAlbum = (color: string, images: string[]) => {
  const albums = { ...colorAlbums.value, [color]: images.slice(0, 10) }
  if (!images.length) delete albums[color]
  saveColorAlbums(albums)
}


// 商品的主图和画册图片
const selectProductPics = computed({
  get: function () {
    const pics: string[] = []
    if (!compProductParam.value.pic || compProductParam.value.pic === '') {
      return pics
    }
    pics.push(compProductParam.value.pic)
    if (!compProductParam.value.albumPics || compProductParam.value.albumPics === '') {
      return pics
    }
    const albumPics = compProductParam.value.albumPics.split(',')
    pics.push(...albumPics)
    return pics
  },
  set: function (newValue) {
    if (!newValue || newValue.length === 0) {
      compProductParam.value.pic = undefined
      compProductParam.value.albumPics = undefined
    } else {
      compProductParam.value.pic = newValue[0]
      compProductParam.value.albumPics = ''
      if (newValue.length > 1) {
        for (let i = 1; i < newValue.length; i++) {
          compProductParam.value.albumPics += newValue[i]
          if (i !== newValue.length - 1) {
            compProductParam.value.albumPics += ','
          }
        }
      }
    }
  }
})


// 处理编辑模式初始化的数据
const handleEditCreated = () => {
  if (compProductParam.value.productAttributeCategoryId) {
    handleProductAttrChange(compProductParam.value.productAttributeCategoryId)
  }
  state.hasEditCreated = true
}


/**
 * 根据商品属性分类ID获取规格和参数
 * @param type 0:规格;1:参数
 * @param cid 商品属性分类ID
 */
const getProductAttrList = async (type: number, cid: number) => {
  const param = { pageNum: 1, pageSize: 100, type: type }
  const res = await getProductAttributeListAPI(cid, param)
  const list = res.data.list
  if (type === 0) {
    state.selectProductAttr = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]!
      const dictionaryOptions = item.inputList?.split(',') || []
      let options = dictionaryOptions.filter(Boolean)
      let values: string[] = []
      if (props.isEdit) {
        if (item.handAddStatus === 1 || item.filterType === 1 || isColorSpec(item.name)) {
          // 编辑状态下获取手动添加编辑属性
          options = getEditAttrOptions(item.id!) || options
        }
        // 编辑状态下获取选中属性
        values = getEditAttrValues(item.name).filter(value => options.includes(value))
      }
      const savedTranslations = compProductParam.value.productAttributeValueList?.find(value => value.productAttributeId === item.id)?.translations
      const translations = { ...savedTranslations }
      if (item.filterType === 1 || isColorSpec(item.name)) {
        for (const language of ['en', 'pt', 'es'] as const) {
          const dictionaryNames = item.translations?.[language]?.inputList?.split(',') || []
          const savedNames = savedTranslations?.[language]?.value?.split(',') || []
          const names = options.map((option, index) => {
            const dictionaryIndex = dictionaryOptions.findIndex(entry =>
              parseProductColor(entry).name.trim() === parseProductColor(option).name.trim(),
            )
            return dictionaryNames[dictionaryIndex]?.split('|')[0]?.trim() || savedNames[index] || ''
          })
          translations[language] = { ...savedTranslations?.[language], value: names.join(',') }
        }
      }
      state.selectProductAttr.push({
        id: item.id,
        name: item.name,
        handAddStatus: item.handAddStatus,
        inputList: item.inputList,
        filterType: item.filterType,
        translations,
        values: values,
        options: options
      })
    }
    if (props.isEdit) {
      // 根据当前有效规格初始化 SKU 表。
      refreshProductSkuList()
    }
  } else {
    state.selectProductParam = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]!
      let value = undefined
      if (props.isEdit) {
        // 编辑模式下获取参数属性
        value = getEditParamValue(item.id!)
      }
      state.selectProductParam.push({
        id: item.id,
        name: item.name,
        value: value,
        translations: compProductParam.value.productAttributeValueList?.find(value => value.productAttributeId === item.id)?.translations,
        inputType: item.inputType,
        inputList: item.inputList
      })
    }
  }
}

// 获取设置的可手动添加属性值
const getEditAttrOptions = (id: number) => {
  const attrValueList = compProductParam.value.productAttributeValueList
  return attrValueList?.find(item => item.productAttributeId === id)?.value?.split(',')
}

// 获取选中的规格值
const getEditAttrValues = (name: string) => {
  const skuList = compProductParam.value.skuStockList!
  const values = new Set<string>()
  for (let i = 0; i < skuList.length; i++) {
    const sku = skuList[i]
    try {
      const spec = JSON.parse(sku!.spData || '[]').find((item: { key: string }) => item.key === name)
      if (spec) values.add(spec.value)
    } catch { /* Ignore malformed legacy SKU metadata. */ }
  }
  return Array.from(values)
}

// 获取属性的值
const getEditParamValue = (id: number) => {
  return compProductParam.value.productAttributeValueList?.find(item => item.productAttributeId === id)?.value
}

const handleProductAttrChange = (value: number) => {
  getProductAttrList(0, value)
  getProductAttrList(1, value)
}

let categoryRequest = 0
watch(() => compProductParam.value.productCategoryId, async (id, previousId) => {
  if (!id) return
  const request = ++categoryRequest
  const response = await getCategoryAttributeInfoAPI(id)
  if (request !== categoryRequest) return
  const attributeCategoryId = response.data[0]?.attributeCategoryId
  if (attributeCategoryId && attributeCategoryId !== compProductParam.value.productAttributeCategoryId) {
    compProductParam.value.productAttributeCategoryId = attributeCategoryId
    if (previousId !== undefined) {
      compProductParam.value.skuStockList = []
      compProductParam.value.productAttributeValueList = []
    }
    handleProductAttrChange(attributeCategoryId)
  }
})

const isColorAttribute = (attribute: ProductAttrVo) => attribute.filterType === 1 || isColorSpec(attribute.name)
const colorTranslation = (attr: ProductAttrVo, language: 'en' | 'pt' | 'es', index: number) =>
  attr.translations?.[language]?.value?.split(',')[index]?.trim() || ''
const setColorTranslation = (attr: ProductAttrVo, language: 'en' | 'pt' | 'es', index: number, value: string) => {
  const names = attr.translations?.[language]?.value?.split(',') || []
  names[index] = value.replace(/,/g, '，')
  attr.translations = {
    ...attr.translations,
    [language]: { ...attr.translations?.[language], value: names.join(',') }
  }
}
const translateColor = async (attr: ProductAttrVo, index: number) => {
  const name = parseProductColor(attr.options?.[index] || '').name.trim()
  const targets = (['en', 'pt', 'es'] as const).filter(language => !colorTranslation(attr, language, index))
  if (!name) return
  if (!targets.length) return ElMessage.info('颜色译文已齐全')
  const key = `${attr.id}-${index}`
  translatingColors[key] = true
  const previous = Object.fromEntries(targets.map(language => [language, colorTranslation(attr, language, index)]))
  try {
    const result = await autoTranslateAPI({ text: name, targetLangs: targets })
    if (parseProductColor(attr.options?.[index] || '').name !== name) return
    for (const language of targets) {
      if (colorTranslation(attr, language, index) === previous[language] && result.data[language]) {
        setColorTranslation(attr, language, index, result.data[language])
      }
    }
  } catch {
    // The shared request client reports the error; both fields remain editable.
  } finally {
    translatingColors[key] = false
  }
}
const changeColorValue = (index: number, value: string, color: string | null) => {
  if (!color) return
  const attr = state.selectProductAttr[index]!
  const next = encodeProductColor(parseProductColor(value).name, color)
  if (next !== value && attr.options?.includes(next)) return ElMessage.warning('该颜色已存在')
  if (next !== value && colorAlbums.value[value]?.length) {
    const albums = { ...colorAlbums.value, [next]: colorAlbums.value[value]! }
    delete albums[value]
    saveColorAlbums(albums)
  }
  attr.options = attr.options?.map(option => option === value ? next : option)
  attr.values = attr.values?.map(option => option === value ? next : option)
  for (const sku of compProductParam.value.skuStockList || []) {
    const specs = JSON.parse(sku.spData || '[]')
    for (const spec of specs) if (spec.key === attr.name && spec.value === value) spec.value = next
    sku.spData = JSON.stringify(specs)
  }
}

const addColorValue = (index: number) => {
  const attr = state.selectProductAttr[index]!
  if (!state.addProductAttrValue.trim()) return ElMessage.warning('请填写颜色名称')
  const value = encodeProductColor(state.addProductAttrValue, state.addProductAttrColor)
  if (attr.options?.includes(value)) return ElMessage.warning('该颜色已存在')
  attr.options ||= []
  attr.values ||= []
  attr.options.push(value)
  attr.values.push(value)
  state.addProductAttrValue = ''
  void translateColor(attr, attr.options.length - 1)
}

const getInputListArr = (inputList: string) => {
  return inputList.split(',')
}

const handleAddProductAttrValue = (idx: number) => {
  const options = state.selectProductAttr[idx]!.options
  if (state.addProductAttrValue == null || state.addProductAttrValue == '') {
    ElMessage({
      message: '属性值不能为空',
      type: 'warning',
      duration: 1000
    })
    return
  }
  if (options!.indexOf(state.addProductAttrValue) !== -1) {
    ElMessage({
      message: '属性值不能重复',
      type: 'warning',
      duration: 1000
    })
    return
  }
  options?.push(state.addProductAttrValue)
  state.addProductAttrValue = ''
}

const handleRemoveProductAttrValue = (idx: number, index: number) => {
  const attr = state.selectProductAttr[idx]!
  const removed = attr.options?.splice(index, 1)[0]
  attr.values = attr.values?.filter(value => value !== removed)
  if (isColorAttribute(attr)) {
    for (const language of ['en', 'pt', 'es'] as const) {
      const names = attr.translations?.[language]?.value?.split(',') || []
      names.splice(index, 1)
      attr.translations = { ...attr.translations, [language]: { ...attr.translations?.[language], value: names.join(',') } }
    }
  }
}

const getProductSkuSp = (row: PmsSkuStock, index: number) => {
  const spData = JSON.parse(row.spData!)
  if (spData != null && index < spData.length) {
    return isColorSpec(spData[index].key) ? parseProductColor(spData[index].value).name : spData[index].value
  } else {
    return null
  }
}

const handleRefreshProductSkuList = async () => {
  if (defaultSkuStock.value == null || !Number.isInteger(defaultSkuStock.value) || defaultSkuStock.value < 0) {
    return ElMessage.warning('默认库存须填写 0 或正整数')
  }
  if (!state.selectProductAttr.length || state.selectProductAttr.some(attr => !attr.values?.length)) {
    ElMessage.warning('请先为每项商品规格至少选择一个选项')
    return
  }
  if (!compProductParam.value.skuStockList?.length) {
    refreshProductSkuList()
    return
  }
  try {
    const stock = defaultSkuStock.value
    await ElMessageBox.confirm(`将按当前规格更新 SKU 组合，并把全部组合的库存设为 ${stock}。未选中的组合会移除。`, '更新 SKU 组合', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    refreshProductSkuList(stock)
  } catch {
    // 用户取消操作
  }
}

const handleSyncProductSkuPrice = async () => {
  try {
    await ElMessageBox.confirm('将同步第一个sku的价格到所有sku,是否继续', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (compProductParam.value.skuStockList && compProductParam.value.skuStockList.length > 0) {
      let tempSkuList: PmsSkuStock[] = []
      tempSkuList = tempSkuList.concat(tempSkuList, compProductParam.value.skuStockList)
      const price = compProductParam.value.skuStockList[0]!.price
      for (let i = 0; i < tempSkuList.length; i++) {
        tempSkuList[i]!.price = price
      }
      compProductParam.value.skuStockList = []
      compProductParam.value.skuStockList = compProductParam.value.skuStockList.concat(compProductParam.value.skuStockList, tempSkuList)
    }
  } catch {
    // 用户取消操作
  }
}

const refreshProductSkuList = (overwriteStock?: number) => {
  const attrs = state.selectProductAttr
  if (!attrs.length || attrs.some(attr => !attr.values?.length)) return
  const signature = (specs: { key: string; value: string }[]) => JSON.stringify([...specs].sort((a,b) => a.key.localeCompare(b.key)))
  const existing = new Map((compProductParam.value.skuStockList || []).map(sku => [signature(JSON.parse(sku.spData || '[]')), sku]))
  let combinations: { key: string; value: string }[][] = [[]]
  for (const attr of attrs) combinations = combinations.flatMap(items => attr.values!.map(value => [...items, { key: attr.name, value }]))
  const usedCodes = new Set<string>()
  compProductParam.value.skuStockList = combinations.map(specs => {
    const saved = existing.get(signature(specs))
    const previousCode = saved?.skuCode?.trim()
    const skuCode = previousCode && !usedCodes.has(previousCode.toLowerCase()) ? previousCode : createSkuCode()
    usedCodes.add(skuCode.toLowerCase())
    return {
      price: compProductParam.value.price || 0,
      lowStock: 5,
      pic: compProductParam.value.pic,
      ...saved,
      stock: overwriteStock ?? (saved ? saved.stock : defaultSkuStock.value ?? 0),
      skuCode,
      spData: JSON.stringify(specs),
    }
  })
}

const mergeProductAttrValue = () => {
  compProductParam.value.productAttributeValueList = []
  for (let i = 0; i < state.selectProductAttr.length; i++) {
    const attr = state.selectProductAttr[i]!
    if ((attr.handAddStatus === 1 || isColorAttribute(attr)) && attr.options != null && attr.options.length > 0) {
      compProductParam.value.productAttributeValueList.push({
        productAttributeId: attr.id,
        value: getOptionStr(attr.options),
        translations: attr.translations
      })
    }
  }
  for (let i = 0; i < state.selectProductParam.length; i++) {
    const param = state.selectProductParam[i]!
    compProductParam.value.productAttributeValueList.push({
      productAttributeId: param.id,
      value: param.value,
      translations: param.translations
    })
  }
}

// 合并商品属性图片

const getOptionStr = (arr: string[]) => {
  let str = ''
  for (let i = 0; i < arr.length; i++) {
    str += arr[i]
    if (i != arr.length - 1) {
      str += ','
    }
  }
  return str
}

const handleRemoveProductSku = (index: number) => {
  const list = compProductParam.value.skuStockList!
  if (list.length === 1) {
    list.pop()
  } else {
    list.splice(index, 1)
  }
}

const getParamInputList = (inputList: string) => {
  return inputList.split(',')
}

const handlePrev = () => {
  emit('prev-step')
}

const handleNext = async () => {
  if (!compProductParam.value.productAttributeCategoryId) {
    return ElMessage.warning('请选择属性类型')
  }
  if (!state.selectProductAttr.length || state.selectProductAttr.some(attr => !attr.values?.length)) {
    return ElMessage.warning('请选择各项商品规格，颜色可使用取色器添加')
  }
  if (hasColorSpec.value && !compProductParam.value.pic?.trim()) {
    document.getElementById('product-default-cover')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return ElMessage.warning('请先上传默认封面')
  }
  if (!compProductParam.value.skuStockList?.length) {
    return ElMessage.warning('请先生成 SKU 组合并确认库存')
  }
  refreshProductSkuList()
  if (compProductParam.value.skuStockList.some(sku => !Number.isFinite(Number(sku.price)) || Number(sku.price) < 0)) {
    return ElMessage.warning('SKU 价格无效，请检查第一步的商品售价')
  }
  const invalidStockIndex = compProductParam.value.skuStockList?.findIndex(sku =>
    sku.stock == null || String(sku.stock).trim() === '' || !Number.isInteger(Number(sku.stock)) || Number(sku.stock) < 0,
  ) ?? -1
  if (invalidStockIndex >= 0) {
    return ElMessage.warning(`请填写第 ${invalidStockIndex + 1} 行 SKU 的商品库存（0 或正整数）`)
  }
  compProductParam.value.stock = (compProductParam.value.skuStockList || []).reduce((total, sku) => total + Number(sku.stock || 0), 0)
  mergeProductAttrValue()
  if (await unifiedDetails.value?.prepare()) emit('next-step')
}
</script>

<template>
  <div style="margin-top: 50px">
    <el-form :model="compProductParam" ref="productAttrForm" label-width="120px" class="form-inner-container">
      <el-form-item label="属性类型：" required>
        <el-select v-model="compProductParam.productAttributeCategoryId" placeholder="请选择属性类型"
          @change="handleProductAttrChange">
          <el-option v-for="item in state.productAttributeCategoryOptions" :key="item.value" :label="item.label"
            :value="item.value">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item v-if="hasColorSpec" id="product-default-cover" label="默认封面：" required>
        <div>
          <single-upload class="default-cover-upload" compact purpose="product-gallery" v-model="compProductParam.pic" />
          <div class="cover-tip">用于官网商品卡片。颜色没有相册时，详情页优先展示此封面。</div>
        </div>
      </el-form-item>
      <el-form-item label="商品规格：" required>
        <el-card shadow="never" class="cardBg">
          <div v-for="(productAttr, idx) in state.selectProductAttr" :key="'productAttr' + idx">
            {{ productAttr.name }}：
            <div v-if="isColorAttribute(productAttr)" class="color-editor">
              <el-checkbox-group v-model="productAttr.values">
              <div v-for="(item, colorIndex) in productAttr.options" :key="item" class="color-entry">
                <div class="color-option-row">
                  <el-checkbox :value="item">
                    <span class="color-dot" :style="{ backgroundColor: parseProductColor(item).color }" />
                    {{ parseProductColor(item).name }}
                  </el-checkbox>
                  <el-color-picker :model-value="parseProductColor(item).color" color-format="hex" @change="changeColorValue(idx, item, $event)" />
                  <el-button link @click="handleRemoveProductAttrValue(idx, colorIndex)">删除</el-button>
                </div>
                <div class="color-entry-panels">
                <details class="color-panel">
                  <summary>多语言名称</summary>
                  <div class="color-translations">
                  <el-input :model-value="colorTranslation(productAttr, 'en', colorIndex)" placeholder="英文颜色名称" @update:model-value="setColorTranslation(productAttr, 'en', colorIndex, $event)">
                    <template #prepend>EN</template>
                  </el-input>
                  <el-input :model-value="colorTranslation(productAttr, 'pt', colorIndex)" placeholder="葡语颜色名称" @update:model-value="setColorTranslation(productAttr, 'pt', colorIndex, $event)">
                    <template #prepend>PT</template>
                  </el-input>
                  <el-input :model-value="colorTranslation(productAttr, 'es', colorIndex)" placeholder="西语颜色名称" @update:model-value="setColorTranslation(productAttr, 'es', colorIndex, $event)">
                    <template #prepend>ES</template>
                  </el-input>
                  <el-button :loading="translatingColors[`${productAttr.id}-${colorIndex}`]" @click="translateColor(productAttr, colorIndex)">补齐译文</el-button>
                  </div>
                </details>
                <details v-if="productAttr.values?.includes(item)" class="color-panel">
                  <summary>颜色相册（选填）
                    <span class="color-album-count">{{ colorAlbums[item]?.length || 0 }}/10</span>
                  </summary>
                  <div class="color-album">
                    <p>支持 JPG、PNG、GIF，单张最大 2 MB</p>
                    <multi-upload purpose="product-gallery" :max-count="10" :model-value="colorAlbums[item] || []"
                      @update:model-value="setColorAlbum(item, $event)" />
                  </div>
                </details>
                </div>
              </div>
              </el-checkbox-group>
              <div class="color-option-row">
                <el-input v-model="state.addProductAttrValue" placeholder="颜色名称，例如米白色" style="width:180px" />
                <el-color-picker v-model="state.addProductAttrColor" color-format="hex" />
                <span>{{ state.addProductAttrColor }}</span>
                <el-button @click="addColorValue(idx)">添加颜色</el-button>
              </div>
            </div>
            <el-checkbox-group v-else-if="productAttr.handAddStatus === 0" v-model="state.selectProductAttr[idx]!.values">
              <el-checkbox v-for="item in getInputListArr(productAttr.inputList!)" :label="item" :key="item"
                class="littleMarginLeft"></el-checkbox>
            </el-checkbox-group>
            <div v-else>
              <el-checkbox-group v-model="state.selectProductAttr[idx]!.values">
                <div v-for="(item, index) in state.selectProductAttr[idx]!.options" style="display: inline-flex;"
                  class="littleMarginLeft" :key="'optons' + index">
                  <el-checkbox :label="item" :key="item"></el-checkbox>
                  <el-button type="primary" link class="littleMarginLeft"
                    @click="handleRemoveProductAttrValue(idx, index)">删除
                  </el-button>
                </div>
              </el-checkbox-group>
              <el-input v-model="state.addProductAttrValue" style="width: 160px;margin-left: 10px" clearable></el-input>
              <el-button class="littleMarginLeft" @click="handleAddProductAttrValue(idx)">增加</el-button>
            </div>
          </div>
        </el-card>
      </el-form-item>
      <el-form-item label="SKU 库存：" required>
        <div class="sku-editor">
          <div class="sku-toolbar">
            <label for="default-sku-stock">默认库存</label>
            <el-input-number id="default-sku-stock" v-model="defaultSkuStock" :min="0" :precision="0" :max="2147483647" />
            <span>更新组合时应用到全部库存</span>
            <el-button type="primary" @click="handleRefreshProductSkuList">
              {{ compProductParam.skuStockList?.length ? '更新 SKU 组合' : '生成 SKU 组合' }}
            </el-button>
          </div>
        <el-table v-if="compProductParam.skuStockList?.length" :data="compProductParam.skuStockList" border>
          <el-table-column v-for="(item, index) in state.selectProductAttr" :label="item.name" :key="item.id"
            align="center">
            <template #default="scope">
              {{ getProductSkuSp(scope.row, index) }}
            </template>
          </el-table-column>
          <el-table-column label="商品库存" min-width="100" align="center">
            <template #header><span class="sku-required">*</span> 商品库存</template>
            <template #default="scope">
              <el-input v-model="scope.row.stock"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="库存预警值" min-width="105" align="center">
            <template #default="scope">
              <el-input v-model="scope.row.lowStock"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="SKU编号" width="160" align="center">
            <template #default="scope">
              <el-input :model-value="scope.row.skuCode" readonly />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="scope">
              <el-button type="primary" link @click="handleRemoveProductSku(scope.$index)">删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
          <div v-else class="sku-empty">选好颜色、尺码等规格后，点击「生成 SKU 组合」。</div>
        </div>
      </el-form-item>
      <el-form-item label="商品参数：">
        <el-card shadow="never" class="cardBg">
          <div v-for="(item, index) in state.selectProductParam" class="param-row" :class="{ littleMarginTop: index !== 0 }"
            :key="'productParam' + index">
            <div class="paramInputLabel">{{ item.name }}:</div>
            <el-select v-if="item.inputType === 1" class="paramInput" v-model="state.selectProductParam[index]!.value">
              <el-option v-for="item2 in getParamInputList(item.inputList!)" :key="item2" :label="item2" :value="item2">
              </el-option>
            </el-select>
            <el-input v-else class="paramInput" v-model="state.selectProductParam[index]!.value"></el-input>
            <multilingual-fields v-model="item.translations" :source="item" :show-chinese="false" :fields="[{ key:'value', label:'参数内容', type:'textarea' }]" />
          </div>
        </el-card>
      </el-form-item>
      <el-form-item v-if="!hasColorSpec" label="商品相册：">
        <multi-upload purpose="product-gallery" v-model="selectProductPics"></multi-upload>
      </el-form-item>
      <el-form-item label="商品详情：">
        <unified-product-details ref="unifiedDetails" :product="compProductParam" />
      </el-form-item>
      <el-form-item>
        <div style="width: 100%; text-align: center;">
          <el-button @click="handlePrev">上一步，填写商品促销</el-button>
          <el-button type="primary" @click="handleNext">下一步，选择商品关联</el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.default-cover-upload :deep(.compact-preview) { width: 96px; height: 96px; }
.cover-tip { margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
.color-entry-panels { margin-top: 8px; border-top: 1px solid var(--el-border-color-lighter); }
.color-panel + .color-panel { border-top: 1px solid var(--el-border-color-lighter); }
.color-panel summary { cursor: pointer; padding: 8px 4px; font-size: 13px; line-height: 1.5; }
.color-panel summary:hover { color: var(--el-color-primary); }
.color-album-count { margin-left: 8px; font-variant-numeric: tabular-nums; color: var(--el-text-color-secondary); }
.color-album { display: grid; gap: 10px; padding: 4px 4px 10px; line-height: 1.5; }
.color-album p { margin: 0; font-size: 12px; color: var(--el-text-color-secondary); }
.color-album :deep(.el-upload-list--picture-card) { margin: 0; }
.color-album :deep(.el-upload-list--picture-card) { --el-upload-list-picture-card-size: 76px; }
.color-album :deep(.el-upload--picture-card) { --el-upload-picture-card-size: 76px; }
.sku-editor { width: 100%; min-width: 0; }
.sku-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.sku-toolbar span { flex: 1 1 220px; color: var(--el-text-color-secondary); }
.sku-toolbar :deep(.el-button + .el-button) { margin-left: 0; }
.sku-empty { padding: 16px; border: 1px dashed var(--el-border-color); border-radius: 6px; color: var(--el-text-color-secondary); }
.sku-required { color: var(--el-color-danger); }
.color-editor { margin:8px 0 20px; }
.color-entry { margin:8px 0 16px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; }
.color-translations { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); align-items: center; gap: 8px; padding: 4px 4px 10px; }
.color-translations > .el-button { justify-self: start; }
.color-option-row { display:flex; align-items:center; gap:12px; margin:8px 0; }
.color-dot { display:inline-block; width:18px; height:18px; margin-right:6px; border:1px solid #cbd3df; border-radius:50%; vertical-align:middle; }
.littleMarginLeft {
  margin-left: 10px;
}

.littleMarginTop {
  margin-top: 10px;
}

.paramInput {
  width: 100%;
}

.paramInputLabel {
  display: block;
  margin-bottom: 6px;
  text-align: left;
  font-weight: 500;
}

.param-row { width:100%; }
.param-row :deep(.multilingual-fields) { width:100%; }


.cardBg {
  background: #F8F9FC;
}
</style>
