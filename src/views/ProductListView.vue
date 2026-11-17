<template>
  <div class="container list-page">
    <!-- 搜索结果 / 分类信息 -->
    <div class="toolbar">
      <span class="result-tip">
        {{ route.query.name || route.query.keyword ? `「${route.query.name || route.query.keyword}」的搜索结果` : '全部商品' }}
        <span class="count">共 {{ total }} 件</span>
      </span>
      <el-radio-group v-model="sort" size="small" @change="load(true)">
        <el-radio-button :value="0">综合</el-radio-button>
        <el-radio-button :value="2">销量</el-radio-button>
        <el-radio-button :value="3">价格升序</el-radio-button>
        <el-radio-button :value="4">价格降序</el-radio-button>
      </el-radio-group>
    </div>

    <div class="product-grid" v-loading="loading" v-if="products.length">
      <ProductCard v-for="p in products" :key="p.id" :product="p" />
    </div>
    <el-empty v-else-if="!loading" description="没有找到相关商品" />

    <div class="pager">
      <el-pagination
        v-model:current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        background
        @current-change="load()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { productApi } from '../api'
import ProductCard from '../components/ProductCard.vue'

const route = useRoute()
const products = ref<any[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 12
const sort = ref(0)
const loading = ref(false)

async function load(resetPage = false) {
  if (resetPage) pageNum.value = 1
  loading.value = true
  try {
    const data = await productApi.search({
      keyword: route.query.keyword as string | undefined,
      brandId: route.query.brandId ? Number(route.query.brandId) : undefined,
      pageNum: pageNum.value,
      pageSize,
      sort: sort.value
    })
    products.value = data.list || []
    total.value = Number(data.total || 0)
  } finally {
    loading.value = false
  }
}

// 顶栏搜索 / 首页品牌点击都会改 query，监听后重新加载
watch(() => route.query, () => load(true))
onMounted(() => load(true))
</script>

<style scoped>
.list-page { min-height: 400px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.result-tip { font-size: 15px; }
.count { color: var(--mall-sub); font-size: 13px; margin-left: 8px; }
.product-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; min-height: 200px; }
.pager { display: flex; justify-content: center; margin-top: 24px; }
</style>
