<template>
  <div id="app">
    <LeafletMapLoader />
  </div>
</template>

<script>
import LeafletMapLoader from './components/LeafletMapLoader.vue'
export default {
  name: 'App',
  components: {
    LeafletMapLoader
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 10px 0px 60px 0px;
}
</style>
