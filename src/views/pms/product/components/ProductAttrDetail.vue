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
import type { ProductAttrPicVo, ProductAttrVo, ProductParamVo } from '@/types/productAttr'
import type { PmsSkuStock } from '@/types/skuStock'
import Tinymce from '@/components/Tinymce/index.vue'

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
  selectProductAttrPics: [] as ProductAttrPicVo[],
  // 可手动添加的商品属性
  addProductAttrValue: '',
  addProductAttrColor: '#30486D',
  // 商品富文本详情激活类型
  activeHtmlName: 'pc'
})

// 商品的ID
const productId = computed(() => {
  return compProductParam.value.id
})

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

// 是否有商品属性图片
const hasAttrPic = computed(() => {
  if (state.selectProductAttrPics.length < 1) {
    return false
  }
  return true
})


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
      let options: string[] | undefined = item.inputList?.split(',').filter(Boolean) || []
      let values: string[] = []
      if (props.isEdit) {
        if (item.handAddStatus === 1) {
          // 编辑状态下获取手动添加编辑属性
          options = getEditAttrOptions(item.id!) || options
        }
        // 编辑状态下获取选中属性
        values = getEditAttrValues(item.name)
      }
      state.selectProductAttr.push({
        id: item.id,
        name: item.name,
        handAddStatus: item.handAddStatus,
        inputList: item.inputList,
        filterType: item.filterType,
        translations: compProductParam.value.productAttributeValueList?.find(value => value.productAttributeId === item.id)?.translations,
        values: values,
        options: options
      })
    }
    if (props.isEdit) {
      // 编辑模式下刷新商品属性图片
      refreshProductAttrPics()
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
const changeColorValue = (index: number, value: string, color: string | null) => {
  if (!color) return
  const attr = state.selectProductAttr[index]!
  const next = encodeProductColor(parseProductColor(value).name, color)
  if (next !== value && attr.options?.includes(next)) return ElMessage.warning('该颜色已存在')
  attr.options = attr.options?.map(option => option === value ? next : option)
  attr.values = attr.values?.map(option => option === value ? next : option)
  for (const sku of compProductParam.value.skuStockList || []) {
    const specs = JSON.parse(sku.spData || '[]')
    for (const spec of specs) if (spec.key === attr.name && spec.value === value) spec.value = next
    sku.spData = JSON.stringify(specs)
  }
  for (const pic of state.selectProductAttrPics) if (pic.name === value) pic.name = next
}

const addColorValue = (index: number) => {
  const attr = state.selectProductAttr[index]!
  const value = encodeProductColor(state.addProductAttrValue, state.addProductAttrColor)
  if (attr.options?.includes(value)) return ElMessage.warning('该颜色已存在')
  attr.options ||= []
  attr.values ||= []
  attr.options.push(value)
  attr.values.push(value)
  state.addProductAttrValue = ''
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
  try {
    await ElMessageBox.confirm('刷新列表将导致sku信息重新生成，是否要刷新', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    refreshProductAttrPics()
    refreshProductSkuList()
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

const handleSyncProductSkuStock = async () => {
  try {
    await ElMessageBox.confirm('将同步第一个sku的库存到所有sku,是否继续', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (compProductParam.value.skuStockList && compProductParam.value.skuStockList.length > 0) {
      let tempSkuList: PmsSkuStock[] = []
      tempSkuList = tempSkuList.concat(tempSkuList, compProductParam.value.skuStockList)
      const stock = compProductParam.value.skuStockList[0]!.stock
      const lowStock = compProductParam.value.skuStockList[0]!.lowStock
      for (let i = 0; i < tempSkuList.length; i++) {
        tempSkuList[i]!.stock = stock
        tempSkuList[i]!.lowStock = lowStock
      }
      compProductParam.value.skuStockList = []
      compProductParam.value.skuStockList = compProductParam.value.skuStockList.concat(compProductParam.value.skuStockList, tempSkuList)
    }
  } catch {
    // 用户取消操作
  }
}

const refreshProductSkuList = () => {
  const attrs = state.selectProductAttr
  if (!attrs.length || attrs.some(attr => !attr.values?.length)) return
  const signature = (specs: { key: string; value: string }[]) => JSON.stringify([...specs].sort((a,b) => a.key.localeCompare(b.key)))
  const existing = new Map((compProductParam.value.skuStockList || []).map(sku => [signature(JSON.parse(sku.spData || '[]')), sku]))
  let combinations: { key: string; value: string }[][] = [[]]
  for (const attr of attrs) combinations = combinations.flatMap(items => attr.values!.map(value => [...items, { key: attr.name, value }]))
  compProductParam.value.skuStockList = combinations.map(specs => {
    const saved = existing.get(signature(specs))
    return { price: compProductParam.value.price || 0, stock: 0, lowStock: 5, pic: compProductParam.value.pic, ...saved, spData: JSON.stringify(specs) }
  })
}

const refreshProductAttrPics = () => {
  state.selectProductAttrPics = []
  if (state.selectProductAttr && state.selectProductAttr.length >= 1) {
    const values = state.selectProductAttr[0]!.values!
    for (let i = 0; i < values.length; i++) {
      let pic = undefined
      if (props.isEdit) {
        // 编辑状态下获取图片
        pic = getProductSkuPic(values[i]!)
      }
      state.selectProductAttrPics.push({ name: values[i], pic: pic })
    }
  }
}

// 获取商品相关属性的图片
const getProductSkuPic = (name: string) => {
  return compProductParam.value.skuStockList?.find(item => {
    const spData = JSON.parse(item.spData!)
    return name === spData[0].value
  })?.pic
}

// 合并商品属性
const mergeProductAttrValue = () => {
  compProductParam.value.productAttributeValueList = []
  for (let i = 0; i < state.selectProductAttr.length; i++) {
    const attr = state.selectProductAttr[i]!
    if (attr.handAddStatus === 1 && attr.options != null && attr.options.length > 0) {
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
const mergeProductAttrPics = () => {
  for (let i = 0; i < state.selectProductAttrPics.length; i++) {
    const skuStockList = compProductParam.value.skuStockList!
    for (let j = 0; j < skuStockList.length; j++) {
      const spData = JSON.parse(skuStockList[j]!.spData!)
      if (spData[0].value === state.selectProductAttrPics[i]!.name) {
        skuStockList[j]!.pic = state.selectProductAttrPics[i]!.pic
      }
    }
  }
}

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

const handleNext = () => {
  if (!state.selectProductAttr.length || state.selectProductAttr.some(attr => !attr.values?.length)) {
    return ElMessage.warning('请选择各项商品规格，颜色可使用取色器添加')
  }
  refreshProductSkuList()
  if (compProductParam.value.skuStockList?.some(sku => !Number.isFinite(Number(sku.price)) || Number(sku.price) < 0 || !Number.isInteger(Number(sku.stock)) || Number(sku.stock) < 0)) {
    return ElMessage.warning('请填写有效的 SKU 价格和非负整数库存')
  }
  compProductParam.value.stock = (compProductParam.value.skuStockList || []).reduce((total, sku) => total + Number(sku.stock || 0), 0)
  mergeProductAttrValue()
  mergeProductAttrPics()
  emit('next-step')
}
</script>

<template>
  <div style="margin-top: 50px">
    <el-form :model="compProductParam" ref="productAttrForm" label-width="120px" class="form-inner-container">
      <el-form-item label="属性类型：">
        <el-select v-model="compProductParam.productAttributeCategoryId" placeholder="请选择属性类型"
          @change="handleProductAttrChange">
          <el-option v-for="item in state.productAttributeCategoryOptions" :key="item.value" :label="item.label"
            :value="item.value">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="商品规格：">
        <el-card shadow="never" class="cardBg">
          <div v-for="(productAttr, idx) in state.selectProductAttr" :key="'productAttr' + idx">
            {{ productAttr.name }}：
            <div v-if="isColorAttribute(productAttr)" class="color-editor">
              <el-checkbox-group v-model="productAttr.values">
              <div v-for="item in productAttr.options" :key="item" class="color-option-row">
                <el-checkbox :value="item">
                  <span class="color-dot" :style="{ backgroundColor: parseProductColor(item).color }" />
                  {{ parseProductColor(item).name }}
                </el-checkbox>
                <el-color-picker :model-value="parseProductColor(item).color" color-format="hex" @change="changeColorValue(idx, item, $event)" />
                <el-button link @click="handleRemoveProductAttrValue(idx, productAttr.options!.indexOf(item))">删除</el-button>
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
        <el-table style="width: 100%;margin-top: 20px" :data="compProductParam.skuStockList" border>
          <el-table-column v-for="(item, index) in state.selectProductAttr" :label="item.name" :key="item.id"
            align="center">
            <template #default="scope">
              {{ getProductSkuSp(scope.row, index) }}
            </template>
          </el-table-column>
          <el-table-column label="销售价格" width="100" align="center">
            <template #default="scope">
              <el-input v-model="scope.row.price"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="促销价格" width="100" align="center">
            <template #default="scope">
              <el-input v-model="scope.row.promotionPrice"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="商品库存" width="80" align="center">
            <template #default="scope">
              <el-input v-model="scope.row.stock"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="库存预警值" width="80" align="center">
            <template #default="scope">
              <el-input v-model="scope.row.lowStock"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="SKU编号" width="160" align="center">
            <template #default="scope">
              <el-input v-model="scope.row.skuCode"></el-input>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="scope">
              <el-button type="primary" link @click="handleRemoveProductSku(scope.$index)">删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button type="primary" style="margin-top: 20px" @click="handleRefreshProductSkuList">刷新列表
        </el-button>
        <el-button type="primary" style="margin-top: 20px" @click="handleSyncProductSkuPrice">同步价格
        </el-button>
        <el-button type="primary" style="margin-top: 20px" @click="handleSyncProductSkuStock">同步库存
        </el-button>
      </el-form-item>
      <el-form-item label="属性图片：" v-if="hasAttrPic">
        <el-card shadow="never" class="cardBg">
          <div v-for="(item, index) in state.selectProductAttrPics" :key="'productAttrPic' + index">
            <span>{{ isColorSpec(state.selectProductAttr[0]?.name || '') ? parseProductColor(item.name || '').name : item.name }}:</span>
            <single-upload v-model="item.pic"
              style="width: 300px;display: inline-block;margin-left: 10px"></single-upload>
          </div>
        </el-card>
      </el-form-item>
      <el-form-item label="规格选项翻译：" v-if="state.selectProductAttr.some(attr => attr.handAddStatus === 1)">
        <div style="width:100%">
          <div v-for="attr in state.selectProductAttr.filter(attr => attr.handAddStatus === 1)" :key="attr.id">
            <text>{{ attr.name }}</text>
            <multilingual-fields v-model="attr.translations" :source="{ value: attr.options?.join(',') }" :fields="[{ key:'value', label:'葡萄牙语选项', type:'textarea', hint:'与中文选项顺序一一对应，用英文逗号分隔；颜色只填葡萄牙语名称，HEX色值无需翻译。' }]" compact />
          </div>
        </div>
      </el-form-item>
      <el-form-item label="商品参数：">
        <el-card shadow="never" class="cardBg">
          <div v-for="(item, index) in state.selectProductParam" :class="{ littleMarginTop: index !== 0 }"
            :key="'productParam' + index">
            <div class="paramInputLabel">{{ item.name }}:</div>
            <el-select v-if="item.inputType === 1" class="paramInput" v-model="state.selectProductParam[index]!.value">
              <el-option v-for="item2 in getParamInputList(item.inputList!)" :key="item2" :label="item2" :value="item2">
              </el-option>
            </el-select>
            <el-input v-else class="paramInput" v-model="state.selectProductParam[index]!.value"></el-input>
            <multilingual-fields v-model="item.translations" :source="item" :fields="[{ key:'value', label:'参数内容', type:'textarea' }]" compact />
          </div>
        </el-card>
      </el-form-item>
      <el-form-item label="商品相册：">
        <multi-upload v-model="selectProductPics"></multi-upload>
      </el-form-item>
      <el-form-item label="商品详情：">
        <el-tabs v-model="state.activeHtmlName" type="card" style="width: 100%;">
          <el-tab-pane label="电脑端详情" name="pc">
            <tinymce :height="720" v-model="compProductParam.detailHtml!" />
          </el-tab-pane>
          <el-tab-pane label="移动端详情" name="mobile">
            <tinymce :height="720" v-model="compProductParam.detailMobileHtml!" />
          </el-tab-pane>
        </el-tabs>
      </el-form-item>
      <el-form-item>
        <div style="width: 100%; text-align: center;">
          <el-button @click="handlePrev">上一步，填写商品促销</el-button>
          <el-button type="primary" @click="handleNext">下一步，选择商品关联</el-button>
        </div>
      </el-form-item>
    <multilingual-fields v-model="compProductParam.translations" :source="compProductParam" :fields="[{key:'detailTitle',label:'详情标题'},{key:'detailDesc',label:'详情描述',type:'textarea'},{key:'detailHtml',label:'PC图文详情',type:'html'},{key:'detailMobileHtml',label:'H5图文详情',type:'html'}]" />
    </el-form>
  </div>
</template>

<style scoped>
.color-editor { margin:8px 0 20px; }
.color-option-row { display:flex; align-items:center; gap:12px; margin:8px 0; }
.color-dot { display:inline-block; width:18px; height:18px; margin-right:6px; border:1px solid #cbd3df; border-radius:50%; vertical-align:middle; }
.littleMarginLeft {
  margin-left: 10px;
}

.littleMarginTop {
  margin-top: 10px;
}

.paramInput {
  width: 250px;
}

.paramInputLabel {
  display: inline-block;
  width: 100px;
  text-align: right;
  padding-right: 10px
}

.cardBg {
  background: #F8F9FC;
}
</style>
