import Vue from 'vue'
import App from './App.vue'
import store from './store'

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// remove vue warning messages
Vue.config.productionTip = false;
Vue.config.devtools = false;

new Vue({
  store,
  render: h => h(App)
}).$mount('#app')
