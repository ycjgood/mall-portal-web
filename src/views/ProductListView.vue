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
/**
 * 【模块职责】商品列表 / 搜索结果页。顶栏搜关键字、首页点品牌、或者改排序、翻页，都落到这一页展示结果。
 * 类比：像超市里按关键词或品牌筛出来的一排货架。
 *
 * 【输入】网址 query：keyword（关键字）、brandId（品牌 id）、name（品牌名，只用于标题显示）；
 *         用户在页面上的操作：点排序按钮、点分页页码。
 * 【输出】渲染商品卡片网格与分页器；调后端 /product/search 接口。
 * 【执行流程】
 *   1) 页面挂载 onMounted 调 load(true)，从第一页开始按当前 query 和排序拉数据。
 *   2) load() 把 keyword、brandId、pageNum、pageSize、sort 拼好交给 productApi.search。
 *   3) 返回的 list 装进 products、total 装进分页总数，页面 v-for 出卡片。
 *   4) 顶栏搜索或首页点品牌会改 route.query，watch 监听到就 load(true) 回到第一页重新查；翻页则 load() 保留当前页。
 * 【关键变量/状态】
 *   - products：当前页的商品数组。
 *   - total：符合条件的商品总数，给分页器算页数。
 *   - pageNum / pageSize：当前第几页、每页 12 件。
 *   - sort：排序方式（0 综合、2 销量、3 价格升序、4 价格降序），值直接传给后端。
 *   - loading：转圈遮罩。
 * 【注意事项】
 *   1. 换搜索条件一定要 load(true) 把页码重置为 1，否则会停在旧页码上查不到东西；只有翻页才用 load()。
 *   2. sort 的数字含义由后端约定，前端别自己换算，直接原样传。
 *   3. 搜索词和品牌来自 route.query，页面里只是读它，不负责修改网址。
 */
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

// 拉列表的核心方法。resetPage 为 true 表示换了搜索条件或排序，要从第 1 页重新查；
// 只是翻页时传 false（或默认），保留当前页码
async function load(resetPage = false) {
  if (resetPage) pageNum.value = 1
  loading.value = true
  try {
    // GET /product/search：把搜索词、品牌、页码、每页数量、排序一次性交给后端筛选排序分页；
    // sort 的数字含义由后端约定（0 综合、2 销量、3 价升、4 价降），前端原样传，别自己换算
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
// 首次进页面也要查一次（从第 1 页开始）。上面那句 watch 则负责之后网址参数变化时重新查
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
