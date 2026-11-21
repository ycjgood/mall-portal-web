<template>
  <div class="container home">
    <!-- 广告轮播 -->
    <el-carousel height="340px" class="banner" v-if="advertises.length">
      <el-carousel-item v-for="ad in advertises" :key="ad.id">
        <img class="banner-img" :src="ad.pic" :alt="ad.name" />
      </el-carousel-item>
    </el-carousel>

    <!-- 品牌精选 -->
    <section v-if="brands.length">
      <h2 class="sec-title">品牌精选</h2>
      <div class="brand-grid">
        <a v-for="b in brands" :key="b.id" class="brand-item card-hover"
           @click="goListByBrand(b.id, b.name)">
          <img :src="b.logo" :alt="b.name" />
          <span>{{ b.name }}</span>
        </a>
      </div>
    </section>

    <!-- 热销商品 -->
    <section>
      <h2 class="sec-title">热销榜单</h2>
      <div class="product-grid">
        <ProductCard v-for="p in hotProducts" :key="'h' + p.id" :product="p" />
      </div>
    </section>

    <!-- 新品上市 -->
    <section>
      <h2 class="sec-title">新品上市</h2>
      <div class="product-grid">
        <ProductCard v-for="p in newProducts" :key="'n' + p.id" :product="p" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 【模块职责】商城首页，也就是打开网站看到的那一屏：广告轮播图、品牌精选、热销榜、新品上市四块。
 * 数据一次从后端要齐再分给四块，页面本身不做搜索、不下单。
 *
 * 【输入】无路由参数；用户的操作是点品牌或点商品卡片（点卡片跳详情由 ProductCard 负责）。
 * 【输出】渲染四大板块；点品牌跳到商品列表页并带 brandId 和 name；调后端 /home/content 接口。
 * 【执行流程】
 *   1) 页面一打开（onMounted）就调 homeApi.content() 拿首页聚合数据。
 *   2) 把返回里的 advertiseList、brandList、hotProductList、newProductList 分别装进四个 ref。
 *   3) 四块内容各自 v-for 渲染；点品牌时 goListByBrand 把品牌 id 放进网址参数。
 * 【关键变量/状态】
 *   - advertises：轮播广告图数组。
 *   - brands：品牌列表，点它带 brandId 去商品列表页。
 *   - hotProducts / newProducts：热销与新品商品数组，交给 ProductCard 渲染。
 * 【注意事项】
 *   1. 四个板块都用 || [] 兜底，后端某块没配数据时页面不报错，只是那一块不显示（用 v-if 控制）。
 *   2. 首页只调 /home/content 这一个聚合接口，不要为每块再单独发请求，减少等待。
 *   3. 后端返回已在 request.ts 解包，这里拿到的 content 直接就是业务对象。
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { homeApi } from '../api'
import ProductCard from '../components/ProductCard.vue'

const router = useRouter()
const advertises = ref<any[]>([])
const brands = ref<any[]>([])
const hotProducts = ref<any[]>([])
const newProducts = ref<any[]>([])

// 点品牌图：把品牌 id 和名字放进网址参数，交给商品列表页按品牌筛选
function goListByBrand(brandId: number, name: string) {
  router.push({ path: '/products', query: { brandId, name } })
}

// onMounted = 页面刚显示出来时自动跑一次。首页只发这一个聚合请求，
// 一次把广告、品牌、热销、新品四块数据都拿回来，比发四次请求更快
onMounted(async () => {
  // GET /home/content：首页聚合接口，一次返回广告、品牌、热销、新品四组数据
  const content = await homeApi.content()
  advertises.value = content.advertiseList || []
  brands.value = content.brandList || []
  hotProducts.value = content.hotProductList || []
  newProducts.value = content.newProductList || []
})
</script>

<style scoped>
.banner { margin-bottom: 24px; border-radius: 8px; overflow: hidden; }
.banner-img { width: 100%; height: 340px; object-fit: cover; display: block; }
.sec-title { font-size: 20px; margin: 28px 0 14px; padding-left: 10px; border-left: 4px solid var(--mall-primary); }
.brand-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
.brand-item { background: #fff; border-radius: 8px; padding: 14px; text-align: center; cursor: pointer; }
.brand-item img { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; }
.brand-item span { display: block; margin-top: 8px; font-size: 13px; }
.product-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
</style>
