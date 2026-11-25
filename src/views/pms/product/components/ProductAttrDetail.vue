<script setup lang="ts">
import MultilingualFields from '@/components/MultilingualFields.vue'
import { ref, reactive, computed, onMounted, inject, type Ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { getProductAttributeCategoryListAPI as fetchProductAttrCateList } from '@/apis/productAttrCate'
import { getProductAttributeListAPI, getProductAttrInfoByCateIdAPI as getCategoryAttributeInfoAPI } from '@/apis/productAttr'
import { isColorSpec, parseProductColor } from '@/utils/product-colors'
import type { PmsProductParam } from '@/types/product'
import type { ElSelectDataVo } from '@/types/common'
import MultiUpload from '@/components/Upload/multiUpload.vue'
import type { ProductAttrVo, ProductParamVo } from '@/types/productAttr'
import type { PmsSkuStock } from '@/types/skuStock'
import UnifiedProductDetails from './UnifiedProductDetails.vue'
import SingleUpload from '@/components/Upload/singleUpload.vue'

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

// 商品的主图和画册图片


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
  // 品质等级由第一步的 7A/10A/12A 等级售价统一维护，不再作为商品参数重复填写。
  const list = res.data.list.filter(item => item.name?.trim() !== '品质等级')
  if (type === 0) {
    state.selectProductAttr = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]!
      const dictionaryOptions = item.inputList?.split(',') || []
      const colorAttribute = item.filterType === 1 || isColorSpec(item.name)
      let options = colorAttribute && !props.isEdit ? [] : dictionaryOptions.filter(Boolean)
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
        for (const language of ['en', 'pt', 'es', 'it', 'fr'] as const) {
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
type ColorAlbum = { thumbnail: string; images: string[] }
function colorAlbums(attr: ProductAttrVo): Record<string, ColorAlbum> {
  try {
    const parsed = JSON.parse(attr.translations?.zh?.colorAlbums || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}
function colorAlbum(attr: ProductAttrVo, key: string) {
  return colorAlbums(attr)[key] || { thumbnail: '', images: [] }
}
function updateColorAlbum(attr: ProductAttrVo, key: string, changes: Partial<ColorAlbum>) {
  const albums = colorAlbums(attr)
  albums[key] = { ...colorAlbum(attr, key), ...changes }
  attr.translations = { ...attr.translations, zh: { ...attr.translations?.zh, colorAlbums: JSON.stringify(albums) } }
}
const getInputListArr = (inputList: string) => inputList.split(',')

function addColorValue(index: number) {
  const attr = state.selectProductAttr[index]!
  const key = createSkuCode().replace('SKU-', 'color-')
  attr.options ||= []
  attr.values ||= []
  attr.options.push(key)
  attr.values.push(key)
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
    if (removed) {
      const albums = colorAlbums(attr)
      delete albums[removed]
      attr.translations = { ...attr.translations, zh: { ...attr.translations?.zh, colorAlbums: JSON.stringify(albums) } }
    }
    for (const language of ['en', 'pt', 'es', 'it', 'fr'] as const) {
      const names = attr.translations?.[language]?.value?.split(',') || []
      names.splice(index, 1)
      attr.translations = { ...attr.translations, [language]: { ...attr.translations?.[language], value: names.join(',') } }
    }
  }
}

function removeColorGroup(attrIndex: number, value: string) {
  const optionIndex = state.selectProductAttr[attrIndex]?.options?.indexOf(value) ?? -1
  if (optionIndex >= 0) handleRemoveProductAttrValue(attrIndex, optionIndex)
}

const getProductSkuSp = (row: PmsSkuStock, index: number) => {
  const spData = JSON.parse(row.spData!)
  if (spData != null && index < spData.length) {
    const { key, value } = spData[index]
    const attr = state.selectProductAttr.find(item => item.name === key)
    return attr && isColorAttribute(attr) ? `颜色组 ${(attr.values?.indexOf(value) ?? -1) + 1}` : value
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
    return ElMessage.warning('请选择各项商品规格')
  }
  if (!compProductParam.value.skuStockList?.length) {
    return ElMessage.warning('请先生成 SKU 组合并确认库存')
  }
  if (!compProductParam.value.pic) {
    const albums = state.selectProductAttr.filter(isColorAttribute)
      .flatMap(attr => (attr.values || []).map(value => colorAlbum(attr, value)))
    const firstPhoto = albums.find(album => album.images.length)?.images[0]
    compProductParam.value.pic = firstPhoto || albums.find(album => album.thumbnail)?.thumbnail
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
      <el-form-item label="商品规格：" required>
        <el-card shadow="never" class="cardBg product-spec-card">
          <div v-for="(productAttr, idx) in state.selectProductAttr" :key="'productAttr' + idx">
            {{ productAttr.name }}：
            <div v-if="isColorAttribute(productAttr)" class="color-editor">
              <div v-for="(item, colorIndex) in productAttr.values" :key="item" class="color-entry">
                <div class="color-option-row">
                  <span class="color-group-label">颜色组 {{ colorIndex + 1 }}</span>
                  <el-button type="danger" link @click="removeColorGroup(idx, item)">删除</el-button>
                </div>
                <div class="color-entry-panels">
                  <div class="color-upload-label">颜色缩略图</div>
                  <single-upload class="color-thumbnail-upload" purpose="product-sku" compact :model-value="colorAlbum(productAttr, item).thumbnail"
                    @update:model-value="updateColorAlbum(productAttr, item, { thumbnail: $event || '' })" />
                  <div class="color-photo-heading">
                    <div class="color-upload-label">商品照片</div>
                    <div class="product-gallery-tip">支持多选，最多上传 10 张，每张不超过 2 MB。</div>
                  </div>
                  <multi-upload purpose="product-gallery" :max-count="10" :model-value="colorAlbum(productAttr, item).images"
                    @update:model-value="updateColorAlbum(productAttr, item, { images: $event })" />
                </div>
              </div>
              <el-button @click="addColorValue(idx)">添加颜色组</el-button>
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
.product-gallery-tip { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
.default-cover-upload :deep(.compact-preview) { width: 96px; height: 96px; }
.color-entry-panels { display:grid; gap:8px; margin-top:8px; padding-top:10px; border-top:1px solid var(--el-border-color-lighter); }
.color-upload-label { color:var(--el-text-color-primary); font-size:14px; font-weight:600; line-height:1.5; }
.color-thumbnail-upload { justify-self:start; }
.color-thumbnail-upload :deep(.compact-preview) { box-sizing:border-box; width:100px; height:100px; }
.color-photo-heading { display:grid; gap:4px; margin-top:8px; }
.product-spec-card, .sku-editor { box-sizing:border-box; width:100%; min-width:0; }
.sku-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.sku-toolbar span { flex: 1 1 220px; color: var(--el-text-color-secondary); }
.sku-toolbar :deep(.el-button + .el-button) { margin-left: 0; }
.sku-empty { padding: 16px; border: 1px dashed var(--el-border-color); border-radius: 6px; color: var(--el-text-color-secondary); }
.sku-required { color: var(--el-color-danger); }
.color-editor { margin:8px 0 20px; }
.color-entry { margin:8px 0 16px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; }
.color-option-row { display:flex; align-items:center; gap:12px; margin:8px 0; }
.color-group-label { flex:1; font-weight:600; }
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
