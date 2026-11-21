<template>
  <!-- 整张卡片可点：拼出 /product/商品id 跳到详情页 -->
  <a class="product-card card-hover" @click="$router.push('/product/' + product.id)">
    <div class="pic-wrap">
      <img :src="product.pic" :alt="product.name" loading="lazy" />
    </div>
    <div class="info">
      <p class="name">{{ product.name }}</p>
      <p class="sub">{{ product.subTitle || '' }}</p>
      <div class="bottom">
        <span class="price">¥{{ product.price }}</span>
        <span class="sale">已售{{ product.sale || 0 }}</span>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
/**
 * 【模块职责】一张可复用的商品小卡片：显示图片、名称、副标题、价格、销量。
 * 首页、商品列表都用它，写一次到处贴。类比：像货架上统一的价签卡。
 *
 * 【输入】props.product：一个商品对象，至少要能取到 id、pic、name、subTitle、price、sale。
 * 【输出】渲染一张卡片；点卡片任意位置跳到该商品的详情页。不调任何后端接口。
 * 【执行流程】1) 父页面用 v-for 把商品数组逐个传进来 2) 卡片把字段填进模板 3) 用户点击就拼出详情网址跳过去。
 * 【关键变量/状态】
 *   - product：父组件传来的单个商品数据（只读，本组件不修改它）。
 * 【注意事项】
 *   1. 整张卡片是可点的 a 标签并绑了跳转，卡片内部别再放会冒泡触发跳转的按钮，否则点按钮也会跳详情。
 *   2. 副标题、销量字段可能为空，模板里用 || '' 与 || 0 兜底，避免页面显示 undefined。
 *   3. 图片加了 lazy 懒加载：商品很多时先只加载看得见的，页面更顺。
 */
// defineProps 声明父页面要传给我一个 product 对象，本组件只读取它、不修改它
defineProps<{ product: any }>()
</script>

<style scoped>
.product-card { background: #fff; border-radius: 8px; overflow: hidden; cursor: pointer; display: block; }
.pic-wrap { height: 180px; overflow: hidden; background: #f7f7f7; }
.pic-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.product-card:hover .pic-wrap img { transform: scale(1.05); }
.info { padding: 10px 12px 14px; }
.name { font-size: 14px; line-height: 1.4; height: 39px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sub { font-size: 12px; color: var(--mall-sub); margin-top: 4px; height: 18px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.bottom { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; }
.price { font-size: 18px; }
.sale { font-size: 12px; color: var(--mall-sub); }
</style>
