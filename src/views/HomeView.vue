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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { homeApi } from '../api'
import ProductCard from '../components/ProductCard.vue'

const router = useRouter()
const advertises = ref<any[]>([])
const brands = ref<any[]>([])
const hotProducts = ref<any[]>([])
const newProducts = ref<any[]>([])

function goListByBrand(brandId: number, name: string) {
  router.push({ path: '/products', query: { brandId, name } })
}

onMounted(async () => {
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
