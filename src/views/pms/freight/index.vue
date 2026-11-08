<script setup lang="ts">
import {ref,onMounted} from 'vue'
import http from '@/utils/http'
import {ElMessage} from 'element-plus'
import {getExchangeRatesAPI,type ExchangeRateResponse} from '@/apis/exchangeRates'
const values=ref({cn:0,usd:0,eur:0,usdManual:0,eurManual:0})
const rates=ref<ExchangeRateResponse|null>(null)
const ready=ref(false),saving=ref(false)
const converted=(currency:'USD'|'EUR')=>Number((Number(values.value.cn)*Number(rates.value?.rates[currency]||0)).toFixed(2))
onMounted(async()=>{try{const [setting,exchange]=await Promise.all([http<typeof values.value>({url:'/system/freight',method:'get'}),getExchangeRatesAPI()]);values.value=setting.data;rates.value=exchange.data;if(!values.value.usdManual) values.value.usd=converted('USD');if(!values.value.eurManual) values.value.eur=converted('EUR');if(exchange.data.stale) ElMessage.warning('当前展示的是最近一次可用汇率')}finally{ready.value=true}})
function changeCn(value:number|undefined){values.value.cn=value??0;if(rates.value){values.value.usd=converted('USD');values.value.eur=converted('EUR');values.value.usdManual=0;values.value.eurManual=0}}
async function save(){if(!rates.value||rates.value.stale){ElMessage.warning('汇率不可用，暂不能保存');return}saving.value=true;try{await http({url:'/system/freight',method:'post',data:values.value});ElMessage.success('运费设置已保存')}finally{saving.value=false}}
</script>
<template><div class="app-container"><el-card><template #header>系统运费设置</template><el-alert title="所有商品统一按件收取；外币运费默认按汇率换算，也可以手动修改。" type="info" :closable="false"/><el-form v-if="ready" style="margin-top:24px"><el-form-item label="中国运费（CNY/件）"><el-input-number :model-value="values.cn" :min="0" :precision="2" @update:model-value="changeCn"/></el-form-item><el-form-item label="美国运费（USD/件）"><el-input-number v-model="values.usd" :min="0" :precision="2" @change="values.usdManual=1"/><span v-if="rates" class="rate-note">汇率：1 CNY = {{ rates.rates.USD }} USD</span></el-form-item><el-form-item label="欧洲运费（EUR/件）"><el-input-number v-model="values.eur" :min="0" :precision="2" @change="values.eurManual=1"/><span v-if="rates" class="rate-note">汇率：1 CNY = {{ rates.rates.EUR }} EUR</span></el-form-item><el-form-item v-if="rates"><span class="rate-note">来源：{{ rates.source }} · {{ rates.date }}</span></el-form-item><el-form-item><el-button type="primary" :loading="saving" :disabled="!rates||rates.stale" @click="save">保存</el-button></el-form-item></el-form></el-card></div></template>
<style scoped>.rate-note{margin-left:16px;color:#8a98a8;font-size:12px}</style>
