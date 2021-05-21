<template>
  <div class="container">
    <div style="height: 750px; width: 93%; overflow: auto;">
      <l-map @ready="mapReady()"
        :zoom="zoom"
        :min-zoom="5"
        :max-zoom="18"
        :center="center"
        :options="mapOptions"
      >
      <!--
        ref="myMap"
        @update:center="centerUpdate"
        @update:zoom="zoomUpdate"
      -->
        <l-marker-cluster :options="clusterOptions">
          <l-rotated-marker
            v-for="marker in markersFiltered()"
            :key="marker.id"
            :visible="true"
            :draggable="false"
            :lat-lng="{lat: marker.position[0], lng: marker.position[1]}"
            :icon="marker.defective ? redMarker : greenMarker"
            rotationOrigin='center 33.5px'
            :rotationAngle="marker.angle"
          >
            <l-tooltip v-if="!!marker.id" :content="marker.id" />
            <l-popup v-if="!!marker.defective || !!marker.meta">
              <div>
                <p v-if="marker.defective">
                  <button @click="repairClicked(marker)">REPAIR</button>
                </p>
                {{ JSON.stringify(marker.meta) }}
              </div>
            </l-popup>
          </l-rotated-marker>
        </l-marker-cluster>
        <l-control-scale :imperial="false" />
        <l-control
          class="example-custom-control"
          position="bottomleft"
          v-show="windAngle"
        >
          <img class="vane" src="@/assets/vane.png" ref="vane" :style="vaneOrient()" />
        </l-control>
        <l-tile-layer :url="url" position="bottomright" :attribution="attribution" />
      </l-map>
    </div>
    <div :class="{container__infoMsg: true, 'container_msgFader': fadeMsg}">{{ infoMessage }}</div>
    <hr />
    <p>Manual data input</p>
    <div class="container__manualInput">
      <textarea class="manualInput__textarea" v-model="txtMarkers" spellcheck="false"/>
      <button class="manualInput__buttonRead" @click="readClicked()">Read</button>
      <button class="manualInput__buttonReset" @click="resetClicked()">Reset</button>
      <button class="manualInput__buttonReset" @click="generateClicked()">Generate</button>
      <button class="manualInput__buttonReset" @click="download()">Download</button>
      <button class="manualInput__buttonReset" @click="$refs.file.click()">Upload</button>
      <input type="file" ref="file" style="display: none" @change="upload()">
    </div>
    <hr />
    <p>JSON API - GET requests</p>
    <div class="container__apiInput">
      <input class="biginput manualInput__textarea" v-model="pullURL" spellcheck="false" />
      <button class="manualInput__buttonRead" @click="apiPullClicked()">Pull</button>
    </div>
    <div class="container__apiInput">
      <input class="biginput manualInput__textarea" v-model="repairURL" spellcheck="false" />
      <button class="manualInput__buttonRead" @click="apiApplyClicked()">Apply</button>
    </div>
  </div>
</template>

<script>
import L from 'leaflet';
import { latLng } from 'leaflet';
import { LMap, LTileLayer, LPopup, LControlScale, LTooltip, LControl, } from 'vue2-leaflet';
import LMarkerCluster from 'vue2-leaflet-markercluster'
import Vue2LeafletRotatedMarker from 'vue2-leaflet-rotatedmarker'
import axios from 'axios'
axios.defaults.timeout = 8000
axios.defaults.withCredentials = false

/* Causes occasional icon rendering defect in Vue2LeafletRotatedMarker:
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: require('@/assets/bol-green.svg'),
  //iconUrl: require('leaflet/dist/images/marker-icon.png'),
  //iconRetinaUrl: require('leaflet/dist/images/marker-icon.png'),
  //shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  shadowSize: [0, 0],
});
*/

const constMarkers = [
  {
    id: 'm1',
    defective: false,
    angle: Math.floor((Math.random() * 360) + 0),
    position: [52.1, 5.281],
    meta: { aa: 'test111', bb: 'dddd' },
  },
  {
    id: 'm2',
    defective: true,
    angle: Math.floor((Math.random() * 360) + 0),
    position: [52.2, 5.4],
    meta: { aa: 'test222', bb: 'eee' },
  },
  {
    id: 'm3',
    defective: true,
    angle: Math.floor((Math.random() * 360) + 0),
    position: [52.2, 4.4],
    meta: { aa: 'test333', bb: 'ffff' },
  },
  {
    id: 'm4',
    defective: false,
    angle: Math.floor((Math.random() * 360) + 0),
    position: [53.2, 4.2],
    meta: { gg: 'xx', ee: 'yy' },
  },
  {
    id: 'generalWindAngle',
    angle: 80,
  },

];

const checkMarkersSyntax = (markers) => {
  if(markers.constructor !== Array) {
    return 'did not receive an array'
  }
  for(const marker of markers) {
    if(marker.id === 'generalWindAngle') {
      continue
    }
    if(!('position' in marker)) {
      return 'position-key is missing from one or more array elements'
    }
    if(!marker.position.length || marker.position.length < 2) {
      return 'insufficient position elements specified'
    }
    if(isNaN(marker.position[0]) || isNaN(marker.position[1])) {
      return 'malformed coordinate supplied'
    }
  }
  return null
}

const round = (value, decimals) => Number(Math.round(value+'e'+decimals)+'e-'+decimals);

export default {
  name: 'HelloWorld',
  props: {
    msg: String
  },
  components: {
    LMap,
    LTileLayer,
    LPopup,
    LControlScale,
    LTooltip,
    LControl,
    LMarkerCluster,
    'l-rotated-marker': Vue2LeafletRotatedMarker,
  },
  data() {
    return {
      fadeMsg: false,
      msgTimer: Function,
      windAngle: NaN,
      infoMessage: '',
      zoom: 7.5,
      center: latLng(52.1007899002, 5.28144793007),
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      showParagraph: false,
      clusterOptions: {
        maxClusterRadius: 60, //80 is the default
        showCoverageOnHover: false,
        animate: false,
      },
      mapOptions: {
        zoomSnap: 0.5
      },
      greenMarker: L.icon({
        iconUrl: require("@/assets/bol-green.svg"),
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -34],
        tooltipAnchor: [16, -30],
        shadowSize: [0, 0],
      }),
      redMarker: L.icon({
        iconUrl: require("@/assets/bol-red.svg"),
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -34],
        tooltipAnchor: [16, -30],
        shadowSize: [0, 0],
      }),
      markers: constMarkers,
      txtMarkers: JSON.stringify(constMarkers),
      pullURL: 'https://libersystems.com/uploads/markers/molens-data.json',
      repairURL: 'https://libersystems.com/molens/api?repair-molen={id}',
    };
  },
  /*computed: {
    markersFiltered() {
      return this.markers.filter(el => el.id !== 'generalWindAngle')
    }
  },*/
  methods: {
    upload() {
      const files = this.$refs.file.files
      if(files.length <= 0) {
        return
      }
      this.printMessage('Uploading...')
      const reader = new FileReader();
      reader.onload = e => {
        this.txtMarkers = e.target.result;
        this.printMessage('Uploaded file ' + files[0].name)
        this.$refs.file.value = null // allow uploading the same file twice
      }
      reader.readAsText(files[0]);
    },
    download() {
      this.printMessage('Downloading map markers...')
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(new Blob([JSON.stringify(this.markers)], { type: 'application/x-binary' }))
      link.setAttribute('download', 'markers.json') //response.headers['content-disposition'].split('filename=')[1]
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
    markersFiltered() {
      let newArray = []
      let newGeneralWindAngle = NaN
      for(const marker of this.markers) {
        if(marker.id === 'generalWindAngle' && !isNaN(marker.angle)) {
          newGeneralWindAngle = marker.angle
          continue
        }
        marker.id = marker.id.toString() // avoid render errors
        newArray.push(marker)
      }
      this.windAngle = newGeneralWindAngle
      return newArray
    },
    vaneOrient() {
      return {
        'transform': 'rotate(' + this.windAngle + 'deg)',
        '-moz-transform': 'rotate(' + this.windAngle + 'deg)',
        '-webkit-transform': 'rotate(' + this.windAngle + 'deg)',
        '-o-transform': 'rotate(' + this.windAngle + 'deg)',
        '-ms-transform': 'rotate(' + this.windAngle + 'deg)',
      }
    },
    generateClicked() {
      let newArray = [];
      let lat, lng;
      const minLat = 51.35
      const addLat = 2.19
      const minLng = 2.873
      const addLng = 3.235
      for(let i = 0; i < 2222; i++) {
        lat = round(minLat + Math.random() * addLat, 4)
        lng = round(minLng + Math.random() * addLng, 5)
        newArray.push({
          id: i,
          defective: Math.floor(Math.random() * 5) < 1 ? true : false,
          angle: Math.floor(Math.random() * 360),
          position: [lat, lng],
          meta: { gg: 'lalala ' + i },
        })
      }
      this.txtMarkers = JSON.stringify(newArray)
    },
    readClicked() {
      let markersCandidate
      this.printMessage('Rendering...')
      setTimeout(() => {
        try {
          markersCandidate = JSON.parse(this.txtMarkers);
        } catch(err) {
          this.printMessage(err)
          return
        }
        let syntaxErr = checkMarkersSyntax(markersCandidate)
        if(syntaxErr) {
          this.printMessage('Bad format: ' + syntaxErr)
          return
        }
        this.markers = markersCandidate
        this.printMessage('Markers were read')
      }, 100);
    },
    resetClicked() {
      this.printMessage('Resetting...')
      setTimeout(() => {
        this.markers = constMarkers;
        this.txtMarkers = JSON.stringify(constMarkers);
        this.printMessage('Markers reset to default')
      }, 100);
    },
    async apiPullClicked() {
      if(!this.pullURL) {
        this.printMessage('URL cannot be empty')
        return
      }
      let response
      try {
        response = await axios.get(this.pullURL)
        if(!response.data) {
          this.printMessage('Got empty response')
          return
        }
        let syntaxErr = checkMarkersSyntax(response.data)
        if(syntaxErr) {
          this.printMessage('Bad response: ' + syntaxErr)
          return
        }
      } catch(err) {
        this.printMessage('Cannot pull: ' + err.message)
        return
      }
      this.printMessage('Data received. Rendering...')
      setTimeout(() => {
        this.markers = response.data
        this.printMessage('New markers were read')
      }, 100)
    },
    apiApplyClicked() {
      if(this.repairURL.indexOf('{id}') < 0) {
        this.printMessage('ERROR: String {id} is required')
        return
      }
      this.applied_repairURL = this.repairURL;
      this.printMessage('Repair action URL was set')
    },
    printMessage(msg) {
      clearTimeout(this.msgTimer)
      this.fadeMsg = false
      this.infoMessage = (new Date()).toISOString() + ' ' + msg;
      this.msgTimer = setTimeout(() => {
        this.fadeMsg = true
      }, 3000)
    },
    async repairClicked(marker) {
      // OPTIONAL disable repair button after pressing
      let specificMolenURL = this.applied_repairURL.replace('{id}', marker.id.toString())
      this.printMessage("Fixing marker " + marker.id)
      let responseMsg = ''
      try {
        let response = await axios.get(specificMolenURL)
        responseMsg = response.statusText
      } catch(err) {
        responseMsg = err.message
      }
      this.printMessage("Marker " + marker.id + ": " + responseMsg)
      // OPTIONAL fetch updated data after repair
    },
    mapReady() {
      //this.map = this.$refs.myMap.mapObject
      this.printMessage('Welcome')
    },
  },
  mounted() {
    this.applied_repairURL = this.repairURL;
  },
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.vane {
  height: 80px;
  width: 80px;
  object-fit: contain;
}
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}

.container_msgFader {
  transition: color 1.5s; /* text color transition duration */
  color: transparent;
}
.container__infoMsg {
  margin: 10px;
}

.container {
  margin-left: auto;
  margin-right: auto;
  padding: 0px 0px 0px 0px;
  /* for edge cases: */
  width: 100%;
  max-width: 100%;
}
.container__manualInput {
  width: 100%;
  height: 300px;
  margin-bottom: 30px;
}
.manualInput__textarea {
  width: 80%;
  height: 100%;
  float: left;
  resize: none;
  border-width: 1px;
}
.manualInput__buttonRead {
  width: 18%;
  padding: 10px;
  float: right;
}
.manualInput__buttonReset {
  width: 18%;
  padding: 12px;
  margin-top: 14px;
  float: right;
}
.biginput {
  font-size: 20px;
}
.container__apiInput {
  width: 100%;
  height: 40px;
  margin-top: 20px;
}

p {
  text-align: left;
}

@media (min-width: 768px) {
  .container{
    width: 750px;
  }
}
@media (min-width: 992px) {
  .container{
    width: 970px;
  }
}
@media (min-width: 1200px) {
  .container{
    width: 1170px;
  }
}
</style>
