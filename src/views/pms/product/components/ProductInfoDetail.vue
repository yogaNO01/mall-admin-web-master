<script setup lang="ts">
import MultilingualFields from '@/components/MultilingualFields.vue'
import { ref, computed, onMounted, inject, watch, type Ref } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { getProductCategoryListWithChildrenAPI } from '@/apis/productCate'
import { getBrandListAPI } from '@/apis/brand'
import { getExchangeRatesAPI, type ExchangeRateResponse } from '@/apis/exchangeRates'
import type { PmsProductParam } from '@/types/product'
import type { ElCascaderDataVo, ElSelectDataVo } from '@/types/common'

// 定义属性
defineProps({
  isEdit: {
    type: Boolean,
    default: false
  }
})

// 定义事件
const emit = defineEmits(['next-step'])

// 获取跨层传递的数据
const compProductParam = inject('product-key') as Ref<PmsProductParam>

// 级联选择器中的商品分类数据
const productCateOptions = ref<ElCascaderDataVo[]>([])
const findCategoryPath = (options: ElCascaderDataVo[], id?: number): ElCascaderDataVo[] => {
  for (const option of options) {
    if (option.value === id) return [option]
    const children = findCategoryPath(option.children || [], id)
    if (children.length) return [option, ...children]
  }
  return []
}
// A leaf can be a top-level category; derive the path from the asynchronously loaded model.
const selectProductCateValue = computed<number[]>({
  get: () => findCategoryPath(productCateOptions.value, compProductParam.value.productCategoryId).map(item => item.value),
  set: (path) => {
    const id = path?.[path.length - 1]
    const category = findCategoryPath(productCateOptions.value, id).pop()
    compProductParam.value.productCategoryId = category?.value
    compProductParam.value.productCategoryName = category?.label
  }
})
// 获取商品分类列表数据
const getProductCateList = async () => {
  const res = await getProductCategoryListWithChildrenAPI()
  const list = res.data
  productCateOptions.value = list.map(item => ({
    label: item.name,
    value: item.id!,
    children: item.children?.length ? item.children.map(it => ({ label: it.name, value: it.id! })) : undefined
  }))
}
// 选择器中的品牌数据
const brandOptions = ref<ElSelectDataVo[]>([])
const exchangeRates = ref<ExchangeRateResponse | null>(null)
const exchangeRateError = ref(false)
type ProductGrade = '7A' | '10A' | '12A'
type GradePrice = {
  grade: ProductGrade
  enabled: boolean
  cny: string
  usd: string
  eur: string
  usdManual: boolean
  eurManual: boolean
}
const productGrades: ProductGrade[] = ['7A', '10A', '12A']
const gradePrices = ref<GradePrice[]>([])
const emptyGradePrices = (): GradePrice[] => productGrades.map((grade, index) => ({
  grade,
  enabled: index === 0,
  cny: index === 0 ? String(compProductParam.value.price ?? 0) : '',
  usd: index === 0 ? String(compProductParam.value.translations?.en?.price || '') : '',
  eur: index === 0 ? String(compProductParam.value.translations?.pt?.price || '') : '',
  usdManual: compProductParam.value.translations?.en?.priceManual === 'true',
  eurManual: compProductParam.value.translations?.pt?.priceManual === 'true',
}))
const loadGradePrices = () => {
  const saved = compProductParam.value.translations?.zh?.gradePrices
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<GradePrice>[]
      gradePrices.value = productGrades.map(grade => {
        const item = parsed.find(entry => entry.grade === grade)
        return {
          grade,
          enabled: item?.enabled === true,
          cny: String(item?.cny ?? ''),
          usd: String(item?.usd ?? ''),
          eur: String(item?.eur ?? ''),
          usdManual: item?.usdManual === true,
          eurManual: item?.eurManual === true,
        }
      })
      if (gradePrices.value.some(item => item.enabled)) return
    } catch { /* Fall through to legacy price migration. */ }
  }
  gradePrices.value = emptyGradePrices()
}
const loadExchangeRates = async () => {
  try {
    exchangeRates.value = (await getExchangeRatesAPI()).data
    exchangeRateError.value = false
  } catch {
    exchangeRateError.value = true
  }
}
const syncConvertedPrices = () => {
  const rates = exchangeRates.value?.rates
  if (!rates?.USD || !rates.EUR) return
  const translations = compProductParam.value.translations || {}
  const originalPrice = Number(compProductParam.value.originalPrice)
  if (compProductParam.value.originalPrice != null && Number.isFinite(originalPrice) && originalPrice >= 0) {
    for (const [language, rate] of [['en', rates.USD], ['pt', rates.EUR]] as const) {
      const saved = translations[language] || {}
      if (saved.originalPriceManual !== 'true') translations[language] = { ...saved, originalPrice: (originalPrice * rate).toFixed(2), originalPriceRate: String(rate) }
    }
    compProductParam.value.translations = translations
  }
}
watch(() => [compProductParam.value.originalPrice, exchangeRates.value], syncConvertedPrices, { deep: true })
const editForeignPrice = (language: 'en' | 'pt', value: string, field: 'price' | 'originalPrice' = 'price') => {
  const translations = compProductParam.value.translations || {}
  compProductParam.value.translations = { ...translations, [language]: { ...translations[language], [field]: value, [`${field}Manual`]: 'true' } }
}
const changeCnyPrice = (field: 'originalPrice', value: string) => {
  compProductParam.value[field] = value === '' ? undefined : Number(value)
  const translations = compProductParam.value.translations || {}
  for (const language of ['en', 'pt'] as const) {
    translations[language] = { ...translations[language], [`${field}Manual`]: 'false' }
  }
  compProductParam.value.translations = translations
  syncConvertedPrices()
}
const persistGradePrices = () => {
  const translations = compProductParam.value.translations || {}
  compProductParam.value.translations = {
    ...translations,
    zh: { ...translations.zh, gradePrices: JSON.stringify(gradePrices.value) },
  }
  const primary = gradePrices.value.find(item => item.enabled)
  if (!primary) return
  compProductParam.value.price = primary.cny === '' ? undefined : Number(primary.cny)
  compProductParam.value.translations.en = {
    ...compProductParam.value.translations.en,
    price: primary.usd,
    priceManual: String(primary.usdManual),
    priceRate: String(exchangeRates.value?.rates.USD || ''),
    priceCurrency: 'USD',
  }
  compProductParam.value.translations.pt = {
    ...compProductParam.value.translations.pt,
    price: primary.eur,
    priceManual: String(primary.eurManual),
    priceRate: String(exchangeRates.value?.rates.EUR || ''),
    priceCurrency: 'EUR',
  }
}
const changeGradeEnabled = (item: GradePrice) => {
  if (!gradePrices.value.some(entry => entry.enabled)) {
    item.enabled = true
    return ElMessage.warning('至少选择一个商品等级')
  }
  persistGradePrices()
}
const changeGradeCny = (item: GradePrice, value: string) => {
  item.cny = value
  const cny = Number(value)
  const rates = exchangeRates.value?.rates
  if (value !== '' && Number.isFinite(cny) && rates?.USD && rates.EUR) {
    item.usd = (cny * rates.USD).toFixed(2)
    item.eur = (cny * rates.EUR).toFixed(2)
    item.usdManual = false
    item.eurManual = false
  }
  persistGradePrices()
}
const changeGradeForeign = (item: GradePrice, currency: 'usd' | 'eur', value: string) => {
  item[currency] = value
  item[currency === 'usd' ? 'usdManual' : 'eurManual'] = true
  persistGradePrices()
}
// 获取品牌列表数据
const getBrandList = async () => {
  const res = await getBrandListAPI({ pageNum: 1, pageSize: 100 })
  brandOptions.value = res.data.list.map(item => ({ label: item.name, value: item.id! }))
}

// 初始化数据
onMounted(async () => {
  loadGradePrices()
  await getProductCateList()
  await getBrandList()
  await loadExchangeRates()
  gradePrices.value.forEach(item => {
    if (item.enabled && item.cny !== '' && !item.usdManual && !item.eurManual) changeGradeCny(item, item.cny)
  })
})
watch(() => compProductParam.value.id, loadGradePrices)

// 表单引用
const productInfoForm = ref<FormInstance>()
// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { min: 2, max: 140, message: '长度在 2 到 140 个字符', trigger: 'blur' }
  ],
  subTitle: [{ required: true, message: '请输入商品副标题', trigger: 'blur' }],
  productCategoryId: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  brandId: [{ required: true, message: '请选择商品品牌', trigger: 'change' }],
  description: [{ required: true, message: '请输入商品介绍', trigger: 'blur' }],
  productSn: [{ required: true, message: '请输入商品货号', trigger: 'blur' }],
  requiredProp: [{ required: true, message: '该项为必填项', trigger: 'blur' }]
}

// 下一步按钮出来事件
const handleNext = async () => {
  const selectedGrades = gradePrices.value.filter(item => item.enabled)
  if (!selectedGrades.length) return ElMessage.warning('至少选择一个商品等级')
  const invalidGrade = selectedGrades.find(item => [item.cny, item.usd, item.eur].some(value => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0))
  if (invalidGrade) return ElMessage.warning(`请填写 ${invalidGrade.grade} 等级的有效人民币、美元和欧元售价`)
  persistGradePrices()
  const prices = [
    { label: '人民币市场价', value: compProductParam.value.originalPrice },
  ]
  const invalidPrice = prices.find(item => item.value == null || !Number.isFinite(Number(item.value)) || Number(item.value) < 0)
  if (invalidPrice) return ElMessage.warning(`请填写有效的${invalidPrice.label}`)
  if (productInfoForm.value) {
    try {
      const valid = await productInfoForm.value.validate()
      if (valid) {
        emit('next-step')
      }
    } catch (error) {
      const fields = error as Record<string, Array<{ message?: string }>>
      const firstField = Object.keys(fields)[0]
      if (firstField) productInfoForm.value.scrollToField(firstField)
      ElMessage({
        message: (firstField && fields[firstField]?.[0]?.message) || '请检查商品信息中的必填项',
        type: 'error',
        duration: 1000
      })
    }
  }
}

// 处理品牌变化
const handleBrandChange = (val: number) => {
  const findBrand = brandOptions.value.find(item => item.value === val)
  compProductParam.value.brandName = findBrand?.label
}
</script>

<template>
  <div style="margin-top: 50px">
    <el-form :model="compProductParam" :rules="rules" ref="productInfoForm" label-width="120px"
      class="form-inner-container">
      <el-form-item label="商品分类：" prop="productCategoryId">
        <el-cascader v-model="selectProductCateValue" :options="productCateOptions">
        </el-cascader>
      </el-form-item>
      <el-form-item label="商品名称：" prop="name">
        <el-input v-model="compProductParam.name"></el-input>
        <multilingual-fields v-model="compProductParam.translations" :source="compProductParam" :show-chinese="false" :fields="[{key:'name',label:'商品名称',maxlength:140}]" />
      </el-form-item>
      <el-form-item label="副标题：" prop="subTitle">
        <el-input v-model="compProductParam.subTitle"></el-input>
        <multilingual-fields v-model="compProductParam.translations" :source="compProductParam" :show-chinese="false" :fields="[{key:'subTitle',label:'副标题'}]" />
      </el-form-item>
      <el-form-item label="商品品牌：" prop="brandId">
        <el-select v-model="compProductParam.brandId" @change="handleBrandChange" placeholder="请选择品牌">
          <el-option v-for="item in brandOptions" :key="item.value" :label="item.label" :value="item.value">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="商品介绍：">
        <el-input :autoSize="true" v-model="compProductParam.description" type="textarea"
          placeholder="请输入内容"></el-input>
        <multilingual-fields v-model="compProductParam.translations" :source="compProductParam" :show-chinese="false" :fields="[{key:'description',label:'商品介绍',type:'textarea'}]" />
      </el-form-item>
      <el-form-item label="商品货号：" prop="productSn">
        <el-input v-model="compProductParam.productSn"></el-input>
      </el-form-item>
      <el-form-item label="商品售价：" required>
        <div class="grade-price-editor">
          <div class="grade-price-header">
            <span>等级</span><span>人民币（CNY）</span><span>美元（USD）</span><span>欧元（EUR）</span>
          </div>
          <div v-for="item in gradePrices" :key="item.grade" class="grade-price-row" :class="{ disabled: !item.enabled }">
            <el-checkbox v-model="item.enabled" @change="changeGradeEnabled(item)">{{ item.grade }}</el-checkbox>
            <el-input :model-value="item.cny" type="number" min="0" :disabled="!item.enabled" @update:model-value="changeGradeCny(item, $event)" />
            <el-input :model-value="item.usd" type="number" min="0" :disabled="!item.enabled" @update:model-value="changeGradeForeign(item, 'usd', $event)" />
            <el-input :model-value="item.eur" type="number" min="0" :disabled="!item.enabled" @update:model-value="changeGradeForeign(item, 'eur', $event)" />
          </div>
          <div class="price-conversion-hint">
            <template v-if="exchangeRates && !exchangeRateError">
              汇率来源：{{ exchangeRates.source || '实时汇率' }}，日期：{{ exchangeRates.date || '今日' }}；
              1 CNY = {{ exchangeRates.rates.USD }} USD，1 CNY = {{ exchangeRates.rates.EUR }} EUR
            </template>
            <span v-else>汇率暂时不可用，美元和欧元价格请手动填写</span>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="市场价（CNY）：" required>
        <el-input :model-value="compProductParam.originalPrice" @update:model-value="changeCnyPrice('originalPrice', $event)"></el-input>
      </el-form-item>
      <el-form-item label="市场价（USD）：">
        <el-input :model-value="compProductParam.translations?.en?.originalPrice" type="number" min="0" @update:model-value="editForeignPrice('en', $event, 'originalPrice')" />
        <div class="price-conversion-hint">汇率：1 CNY = {{ exchangeRates?.rates.USD || '--' }} USD</div>
      </el-form-item>
      <el-form-item label="市场价（EUR）：">
        <el-input :model-value="compProductParam.translations?.pt?.originalPrice" type="number" min="0" @update:model-value="editForeignPrice('pt', $event, 'originalPrice')" />
        <div class="price-conversion-hint">汇率：1 CNY = {{ exchangeRates?.rates.EUR || '--' }} EUR</div>
      </el-form-item>
      <el-form-item label="商品库存：">
        <el-input v-model="compProductParam.stock"></el-input>
      </el-form-item>
      <el-form-item label="计量单位：">
        <el-input v-model="compProductParam.unit"></el-input>
        <multilingual-fields v-model="compProductParam.translations" :source="compProductParam" :show-chinese="false" :fields="[{key:'unit',label:'计量单位'}]" />
      </el-form-item>
      <el-form-item label="商品重量：">
        <el-input v-model="compProductParam.weight" style="width: 300px"></el-input>
        <span style="margin-left: 20px">克</span>
      </el-form-item>
      <el-form-item label="排序">
        <el-input v-model="compProductParam.sort"></el-input>
      </el-form-item>
      <el-form-item>
        <div style="width: 100%;text-align: center;">
          <el-button type="primary" @click="handleNext()">下一步，填写商品促销</el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.price-conversion-hint { margin-top: 6px; color: #8a98a8; font-size: 12px; line-height: 1.7; }
.grade-price-editor { width: 100%; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 6px; background: #fafbfd; }
.grade-price-header,.grade-price-row { display: grid; grid-template-columns: 90px repeat(3,minmax(140px,1fr)); gap: 12px; align-items: center; }
.grade-price-header { margin-bottom: 8px; color: var(--el-text-color-secondary); font-size: 13px; }
.grade-price-row + .grade-price-row { margin-top: 10px; }
.grade-price-row.disabled { opacity: .62; }
.foreign-price-row { display:flex; align-items:center; gap:8px; width:100%; margin-top:8px; white-space:nowrap; }
.foreign-price-row .el-input { width:150px; }
.foreign-price-row span { color:#8a98a8; font-size:12px; }
</style>
