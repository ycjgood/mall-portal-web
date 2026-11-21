<template>
  <!-- 整站外壳（顶栏 + 中间页面 + 页脚）都在这个组件里；这里只负责放它 -->
  <MainLayout />
</template>

<script setup lang="ts">
/**
 * 【模块职责】最外层的空壳页面。它自己几乎不画东西，只负责把 MainLayout（顶栏 + 中间内容区 + 页脚）放上来。
 * 类比：像相框，真正的照片（各个页面）由路由放进相框中间。
 *
 * 【输入】无 props、无路由参数。网址变化后该显示哪一页，由 MainLayout 里的 router-view 决定。
 * 【输出】整站统一的外壳：顶部导航、搜索框、购物车入口、页脚。
 * 【执行流程】1) 引入 MainLayout 组件 2) 在模板里写 MainLayout 标签 3) 浏览器渲染，剩下的交给布局组件。
 * 【关键变量/状态】本文件没有响应式变量，只有一个组件引用 MainLayout。
 * 【注意事项】
 *   1. 想加全站都有的东西（比如公告条），改 MainLayout.vue，不要堆在 App.vue。
 *   2. 后端接口统一返回 CommonResult { code, message, data }，解包在 src/api/request.ts 做，页面拿到的已是 data。
 */
import MainLayout from './layouts/MainLayout.vue'
</script>
