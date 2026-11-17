<template>
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
