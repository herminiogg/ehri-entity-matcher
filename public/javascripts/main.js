const HTTPS = !window.location.host.startsWith("localhost");

const COLS = {
  input: "Input",
  id: "ID",
  name: "Name",
  country: "Country",
  lat: "Latitude",
  lng: "Longitude"
};

const TYPES = {
  Place: "Place",
  Person: "People",
  CorporateBody: "Corporate Bodies",
  Term: "Term",
  Repository: "Archival Institution"
};

Vue.component("output-data", {
  props: {
    hasMatches: Boolean,
    selection: Array,
  },
  data: function () {
    return {
      includeHeaders: true,
      columns: Object.keys(COLS)
    }
  },
  computed: {
    csv: function () {
      let data = this.selection.map((r, i) => {
        let [input, match] = r;
        let values = [];
        if (match) {
          match["input"] = input;
          this.columnList.forEach(col => {
            if (this.columns.includes(col)) {
              values.push(match[col] ? match[col] : "");
            }
          });
        } else {
          this.columnList.forEach(col => {
            if (this.columns.includes(col)) {
              values.push(col === "input" ? input : "");
            }
          });
        }
        return values;
      });
      if (this.includeHeaders) {
        data.unshift(this.columnList.filter(col => this.columns.includes(col)));
      }

      let sep = ",";
      return data.map(arr => {
        return arr.map(v => {
          let enc = v.toString().replace(/"/g, "\"\"");
          return enc.includes(sep) ? "\"" + enc + "\"" : enc;
        }).join(sep) + "\n";
      }).join("");
    },
    boxSize: function () {
      return Math.min(20, this.selection.length + (this.includeHeaders ? 1 : 0));
    },
    columnList: function () {
      return Object.keys(COLS);
    },
  },
  methods: {
    downloadCsv: function (filename, text) {
      let element = document.createElement('a');
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },
    copyCsv: function () {
      let elem = document.getElementById("output-data");
      elem.select();
      document.execCommand("copy");
    },
    columnLabel: function (key) {
      return COLS[key];
    },
  },
  template: `
    <section id="output" v-show="hasMatches">
      <button class="button is-pulled-right is-info" v-on:click="downloadCsv('entity-matching-data.csv', csv)">        
        <span class="icon is-small">
          <i class="fa fa-download"></i>
        </span>
        <span>Download</span>
      </button>
      <h3 class="subtitle is-3">Output Data</h3>
      <div class="field">
        <label class="checkbox">
          <input type="checkbox" v-model="includeHeaders">
          <span>Include Headers</span>
          &nbsp;
        </label> 
      </div>
      <div class="field">
        <label class="checkbox" v-for="key in columnList">
          <input type="checkbox" v-bind:value="key" v-model="columns">
          <span>{{columnLabel(key)}}</span>
          &nbsp;
        </label> 
      </div>
      <textarea class="textarea" v-bind:rows="boxSize" 
          readonly id="output-data" v-on:click="copyCsv">{{csv}}</textarea>
    </section>
  `
});

Vue.component("result-map", {
  props: {
    hasMatches: Boolean,
    selection: Array,
  },
  data: function () {
    return {
      markers: null,
      map: null
    }
  },
  computed: {
    points: function () {
      return this.selection.map((r, i) => {
        let [_, match] = r;
        if (match && match.lat && match.lng) {
          return L.latLng([match.lat, match.lng]);
        }
        return null;
      }).filter(v => v !== null);
    }
  },
  mounted: function () {
    this.map = L.map('map', {
      minZoom: 1,
      maxZoom: 15
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
    this.map.setView([51.5, 0.0], 13);
    this.markers = L.layerGroup().addTo(this.map);
  },
  watch: {
    selection: function (values) {
      this.markers.clearLayers();
      values.forEach((item, i) => {
        let [input, match] = item;
        if (match && match.lat && match.lng) {
          L.marker([match.lat, match.lng]).addTo(this.markers)
              .bindPopup(input, {
                closeOnClick: false,
                autoClose: false
              }).openPopup();
          // L.popup()
          //      .setLatLng([match.lat, match.lng])
          //      .setContent(input)
          //      .openOn(this.map);
          if (this.points) {
            this.map.fitBounds(this.points);
          }
        }
      });
    }
  },
  template: `
    <div id="result-map">
        <div class="box" id="map"></div>
    </div>
  `
});

new Vue({
  el: '#app',
  data: {
    data: "",
    options: {
      phonetic: {
        name: "Phonetic Matches",
        value: false,
      },
    },
    tOptions: {
      Place: {
        population: {
          name: "Boost higher population places",
          value: false,
        }
      }
    },
    type: "Place",
    types: TYPES,
    results: [],
    selected: [],
    loading: false,
    progress: 0
  },
  computed: {
    typeOptions: function() {
      return this.tOptions[this.type] || {};
    },
    allOptions: function() {
      let all = {...this.options, ...this.typeOptions};
      return Object.keys(all).map ((k, index) => {
        return all[k].value;
      });
    },
    entities: function () {
      return this.data.trim().split("\n").filter(e => e.trim() !== "");
    },
    hasMatches: function () {
      return this.results.filter(r => r[1].length > 0).length > 0;
    },
    showMap: function () {
      return this.type === 'Place';
    },
    selection: function () {
      return this.results.map((r, i) => {
        let [input, matches] = r;
        let match = matches.length > 0 && matches[this.selected[i]]
            ? matches[this.selected[i]]
            : null;
        return [input, match];
      });
    }
  },
  methods: {
    find: function () {
      this.loading = true;
      let socketUrl = jsRoutes.controllers.HomeController.findWS(this.type, ...this.allOptions).webSocketURL(HTTPS);
      let socket = new WebSocket(socketUrl);
      this.results = [];
      this.selected = [];
      this.progress = 0;
      socket.addEventListener('open', e => {
        socket.send(this.data);
      });
      socket.addEventListener("message", e => {
        let data = JSON.parse(e.data);
        this.results.push(data);
        if (data[1]) {
          this.selected[this.results.length - 1] = 0;
        }
        this.progress = (100 / this.entities.length) * this.results.length;
        if (this.results.length === this.entities.length) {
          this.loading = false;
          socket.close();
        }
      });
      socket.addEventListener("close", e => {
        console.log("Closed socket...");
        this.loading = false;
      });
    },
    selectResult: function (idx, ridx) {
      if (this.isSelected(idx, ridx)) {
        this.selected.splice(idx, 1, null);
      } else {
        this.selected.splice(idx, 1, ridx);
      }
    },
    clearResult: function (idx) {
      let [input, _] = this.results[idx];
      this.results.splice(idx, 1, [input, []]);
      this.selected.splice(idx, 1, null);
    },
    isSelected: function (idx, ridx) {
      return this.selected[idx] === ridx;
    },
  },
  template: `
    <div id="subject-matcher">
      <div id="main-content" v-bind:class="showMap ? 'is-two-thirds' : 'is-full'">
        <div id="controls">
          <div class="field">
            <textarea class="textarea" rows="5" v-model="data" placeholder="List entities one per line"></textarea>
          </div>
          <progress class="progress is-info" v-bind:value="progress" max="100"></progress>
          <div class="field" v-bind:disabled="data.trim() === ''">      
            <button class="button is-primary" 
                v-bind:disabled="data.trim() === ''" v-on:click="find"
                v-bind:class="{'is-loading': loading}">
                <span class="icon is-small">
                  <i class="fa fa-search"></i>
                </span>
                <span>Find Matches</span>
            </button>
            <span id="type-selector">
              <label class="radio" v-for="(value, key) in types">
                <input type="radio" name="answer" v-bind:value="key" v-model="type">
                {{value}}
              </label>
            </span>            
          </div>
          <div id="options">
            <span v-for="(data, option) in options" class="match-option">
              <label class="check-box">
                <input type="checkbox" name="option" v-model="options[option].value">
                {{data.name}}
              </label>
            </span>
            <span v-for="(data, option) in typeOptions" class="match-option">
              <label class="check-box">
                <input type="checkbox" name="option" v-model="typeOptions[option].value">
                {{data.name}}
              </label>
            </span>
          </div>
        </div>
       
        <div id="all-match-results" v-if="results.length">
          <div class="match-results" v-for="([input, matches], idx) in results">
            <h3 class="title is-4">Input: &quot;{{input}}&quot;</h3>
            <table class="table is-fullwidth is-narrow is-bordered is-hoverable" v-if="matches.length > 0" id="results">
              <thead>
                <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Alt. Names</th>
                    <th>Country</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>
                        <span class="tag" v-on:click="clearResult(idx)">
                         Clear
                         <button class="delete is-small"></button>
                        </span>
                    </th>
                </tr>
              </thead>
              <tbody v-if="matches.length > 0">
                <tr v-for="(result, ridx) in matches" v-on:click="selectResult(idx, ridx)">
                   <td>{{result.id}}</td>
                   <td>{{result.type}}</td>
                   <td>{{result.name}}</td>
                   <td v-bind:title="result.alternateNames ? result.alternateNames.join(', ') : ''">
                    {{result.alternateNames ? result.alternateNames.slice(0, 4).join(", ") : ""}}
                    </td>
                   <td>{{result.country}}</td>
                   <td>{{result.lat}}</td>
                   <td>{{result.lng}}</td>
                   <td>
                    <a class="button" v-bind:class="{'is-success': selected[idx] === ridx}">
                        <span class="icon is-small">
                            <i class="fa fa-check"></i>
                        </span>
                        <span>Select</span>
                    </a>
                   </td>
                </tr>
              </tbody>
            </table>
            <span v-else>No Matches</span>
          </div>
        </div>  
        
      </div>
      <div id="sidebar">
        <result-map v-if="showMap" 
          v-bind:has-matches="hasMatches" 
          v-bind:selection="selection" />      
        <output-data 
          v-bind:has-matches="hasMatches" 
          v-bind:selection="selection" />      
      </div>
    </div>
  `
});