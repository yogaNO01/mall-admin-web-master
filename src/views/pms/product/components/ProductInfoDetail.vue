<script setup lang="ts">
import MultilingualFields from '@/components/MultilingualFields.vue'
import { ref, computed, onMounted, inject, type Ref } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { getProductCategoryListWithChildrenAPI } from '@/apis/productCate'
import { getBrandListAPI } from '@/apis/brand'
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
// 获取品牌列表数据
const getBrandList = async () => {
  const res = await getBrandListAPI({ pageNum: 1, pageSize: 100 })
  brandOptions.value = res.data.list.map(item => ({ label: item.name, value: item.id! }))
}

// 初始化数据
onMounted(async () => {
  await getProductCateList()
  await getBrandList()
})

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
  requiredProp: [{ required: true, message: '该项为必填项', trigger: 'blur' }]
}

// 下一步按钮出来事件
const handleNext = async () => {
  const prices = [
    { label: '人民币商品售价', value: compProductParam.value.price },
    { label: '人民币市场价', value: compProductParam.value.originalPrice },
    { label: '巴西雷亚尔商品售价', value: compProductParam.value.translations?.pt?.price },
    { label: '巴西雷亚尔市场价', value: compProductParam.value.translations?.pt?.originalPrice },
  ]
  const invalidPrice = prices.find(item => item.value === '' || item.value == null || !Number.isFinite(Number(item.value)) || Number(item.value) < 0)
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
      </el-form-item>
      <el-form-item label="副标题：" prop="subTitle">
        <el-input v-model="compProductParam.subTitle"></el-input>
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
      </el-form-item>
      <el-form-item label="商品货号：">
        <el-input v-model="compProductParam.productSn"></el-input>
      </el-form-item>
      <el-form-item label="商品售价（CNY）：">
        <el-input v-model="compProductParam.price"></el-input>
      </el-form-item>
      <el-form-item label="市场价（CNY）：">
        <el-input v-model="compProductParam.originalPrice"></el-input>
      </el-form-item>
      <el-form-item label="商品库存：">
        <el-input v-model="compProductParam.stock"></el-input>
      </el-form-item>
      <el-form-item label="计量单位：">
        <el-input v-model="compProductParam.unit"></el-input>
      </el-form-item>
      <el-form-item label="商品重量：">
        <el-input v-model="compProductParam.weight" style="width: 300px"></el-input>
        <span style="margin-left: 20px">克</span>
      </el-form-item>
      <el-form-item label="排序">
        <el-input v-model="compProductParam.sort"></el-input>
      </el-form-item>
    <multilingual-fields v-model="compProductParam.translations" :source="compProductParam" :fields="[{key:'name',label:'商品名称',maxlength:140},{key:'subTitle',label:'副标题'},{key:'description',label:'商品介绍',type:'textarea'},{key:'keywords',label:'搜索关键词',type:'textarea'},{key:'unit',label:'计量单位'},{key:'price',label:'商品售价（巴西雷亚尔 BRL / R$）',type:'number',hint:'商城切换为葡萄牙语时使用此金额，不会按汇率自动换算。'},{key:'originalPrice',label:'市场价（巴西雷亚尔 BRL / R$）',type:'number',hint:'用于葡萄牙语商城的划线原价。'}]" />
      <el-form-item>
        <div style="width: 100%;text-align: center;">
          <el-button type="primary" @click="handleNext()">下一步，填写商品促销</el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped></style>
