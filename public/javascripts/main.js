
const HTTPS = window.location.host !== "localhost:9000"; // HACK!

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
  Term: "Term"
};

Vue.component("output-data", {
  props: {
    hasMatches: Boolean,
    results: Array,
    selected: Array
  },
  data: function() {
    return {
      includeHeaders: true,
      columns: Object.keys(COLS)
    }
  },
  computed: {
    csv: function() {
      let data = this.results.map((r, i) => {
        let [input, matches] = r;
        let values = [];
        if (matches.length > 0 && matches[this.selected[i]]) {
          let match = matches[this.selected[i]];
          match["input"] = input;
          Object.keys(COLS).forEach(col => {
            if (this.columns.includes(col)) {
              values.push(match[col] ? match[col] : "");
            }
          });
        } else {
          Object.keys(COLS).forEach(col => {
            if (this.columns.includes(col)) {
              values.push(col === "input" ? input : "");
            }
          });
        }
        return values;
      });
      if (this.includeHeaders) {
        data.unshift(Object.keys(COLS).filter(col => this.columns.includes(col)));
      }

      let sep = ",";
      return data.map( arr => {
        return arr.map(v => {
          let enc = v.toString().replace(/"/g, "\"\"");
          return enc.includes(sep) ? "\"" + enc + "\"" : enc;
        }).join(sep) + "\n";
      }).join("");
    },
  },
  methods: {
    downloadCsv: function(filename, text) {
      let element = document.createElement('a');
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },
    copyCsv: function() {
      let elem = document.getElementById("output-data");
      elem.select();
      document.execCommand("copy");
    },
    columnLabel: function(key) {
      return COLS[key];
    },
    columnList: function() {
      return Object.keys(COLS);
    }
  },
  template: `
    <div v-show="hasMatches">
      <hr/>
      <button class="button is-pulled-right is-info" v-on:click="downloadCsv('entity-matching-data.csv', csv)">        
        <span class="icon is-small">
          <i class="fa fa-download"></i>
        </span>
        <span>Download</span>
      </button>
      <h2 class="subtitle is-3">Output Data</h2>
      <div class="field">
        <label class="checkbox">
          <input type="checkbox" v-model="includeHeaders">
          <span>Include Headers</span>
          &nbsp;
        </label> 
      </div>
      <div class="field">
        <label class="checkbox" v-for="key in columnList()">
          <input type="checkbox" v-bind:value="key" v-model="columns">
          <span>{{columnLabel(key)}}</span>
          &nbsp;
        </label> 
      </div>
      <textarea class="textarea" v-bind:rows="results.length" 
          readonly id="output-data" v-on:click="copyCsv">{{csv}}</textarea>
    </div>
  `
});

new Vue({
  el: '#app',
  data: {
    data: "",
    type: "Place",
    types: TYPES,
    results: [],
    selected: [],
    loading: false,
    progress: 0
  },
  computed: {
    entities: function() {
      return this.data.trim().split("\n").filter(e => e.trim() !== "");
    },
    hasMatches: function() {
      return this.results.filter(r => r[1].length > 0).length > 0;
    }
  },
  methods: {
    find: function () {
      this.loading = true;
      let socketUrl = jsRoutes.controllers.HomeController.findWS(this.type).webSocketURL(HTTPS);
      let socket = new WebSocket(socketUrl);
      this.results = [];
      this.selected = [];
      this.progress = 0;
      socket.addEventListener('open', e => {
        socket.send(this.data);
      });
      socket.addEventListener("message", e => {
        let data = JSON.parse(e.data);
        console.log("Data: ", data)
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
      });
    },
    selectResult: function(idx, ridx) {
      if (this.isSelected(idx, ridx)) {
        this.selected.splice(idx, 1);
      } else {
        this.selected.splice(idx, 1, ridx);
      }
    },
    clearResult: function(idx) {
      let [input, _] = this.results[idx];
      this.results.splice(idx, 1, [input, []]);
      this.selected.splice(idx, 1);
    },
    isSelected: function(idx, ridx) {
      return this.selected[idx] === ridx;
    },
  },
  template: `
    <div id="subject-matcher">
      <div class="field">
        <textarea class="textarea" rows="5" v-model="data" placeholder="List entities one per line"></textarea>
      </div>
      <div class="field" v-bind:disabled="data.trim() === ''">      
        <label class="radio" v-for="(value, key) in types">
          <input type="radio" name="answer" v-bind:value="key" v-model="type">
          {{value}}
        </label>
      </div>
      <div class="field">
        <button class="button is-primary" 
            v-bind:disabled="data.trim() === ''" v-on:click="find"
            v-bind:class="{'is-loading': loading}">
            <span class="icon is-small">
              <i class="fa fa-search"></i>
            </span>
            <span>Find Matches</span>
        </button>
      </div> 
      <hr/>
      <progress class="progress is-info" v-bind:value="progress" max="100"></progress>
      
      <div class="box" v-for="([input, matches], idx) in results">
        <h3 class="title is-4">Input: &quot;{{input}}&quot;</h3>
        <table class="table is-fullwidth is-bordered is-hoverable" v-if="matches.length > 0" id="results">
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
      
      <output-data 
        v-bind:has-matches="hasMatches" 
        v-bind:results="results" 
        v-bind:selected="selected" />      
    </div>
  `
});