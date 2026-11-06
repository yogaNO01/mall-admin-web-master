export type ProductColor = { value: string; name: string; color: string }
const palette: Record<string, string> = {
  米白色:'#F2EDE3', 白色:'#FFFFFF', 黑色:'#252525', 深蓝色:'#30486D', 浅蓝色:'#B8D5ED',
  棕色:'#875536', 玳瑁色:'#78533B', 金色:'#C7A45B', 银色:'#C8CED4', 粉色:'#E6B3C4',
  紫色:'#AC92CA', 绿色:'#567D64', 蓝色:'#5C8CAE', 透明色:'#E7F0F4', 红色:'#BF5454',
}
export const isColorSpec = (name: string) => /颜色|色彩|colou?r/i.test(name)
export const parseProductColor = (value: string): ProductColor => {
  const [label = '', hex = ''] = String(value || '').split('|')
  const direct = /^#[0-9a-f]{6}$/i
  return { value, name: label, color: direct.test(hex) ? hex.toUpperCase() : direct.test(label) ? label.toUpperCase() : palette[label] || '#D7DEE6' }
}
export const encodeProductColor = (name: string, hex: string) =>
  `${name.trim() || hex.toUpperCase()}|${hex.toUpperCase()}`

