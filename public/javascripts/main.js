const HTTPS = !window.location.host.startsWith("localhost");

const COLS = {
  label: "Label",
  termLabel: "Term Label",
  language: "Language",
  term: "Term",
  confidence: "Confidence"
};

const COLS_TSV = {
  label: "Label",
  term: "Term"
};

const EHRI_VOCABULARIES = {
  ehri_terms: "http://data.ehri-project.eu/vocabularies/ehri-terms/"
};

Vue.component("docs", {
  template: `
    <div class="docs message">
    <div class="message-body">
        <p class="block">This is a tool for translating a list of textual references to controlled vocabulary items,
            using fuzzy matching where appropriate. For example, if you have a list place names you
            want to put on a map, the tool will search the Geonames database for each reference, 
            present the most appropriate options, and allow you to copy the result as CSV containing 
            the <a href="https://www.geonames.org">Geonames</a> IDs, latitude and longitude in a tabular format that can be imported into a 
            spreadsheet or other system.           
        </p>
        <p class="block">
            While places were the original use-case, the tool also supports other entities in the
            <a href="https://portal.ehri-project.eu/">EHRI portal</a> database.
        </p>
    
</div>
    </div>
  `
});

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
      let data = this.selection.flatMap((r, i) => {
         let [input, matches] = r;
         return matches.map(match => {
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
    tsv: function() {
      let data = this.selection.flatMap((r, i) => {
       let [input, matches] = r;
       return matches.map(match => {
         let values = [];
         if (match) {
           this.tsvColumns.forEach(col => {
             if (col === "term") {
               let [key, value] = this.ehriVocabularies.find(function(i) {
                 let [key, value] = i;
                 return match[col].startsWith(value);
               });
               if(key !== undefined && value !== undefined) {
                 values.push(match[col].replace(value, key + "-"));
                 values.push(key);
               } else {
                 values.push(match[col]);
               }
             } else {
               values.push(match[col]);
             }
           });
         }
         return values;
       });
      });

      let sep = "\t";
      return data.map(arr => {
        return arr.map(v => {
          let enc = v.toString().replace(/"/g, "\"\"");
          return enc.includes(sep) ? "\"" + enc + "\"" : enc;
        }).join(sep) + "\n";
      }).join("");
    },
    boxSize: function () {
      let length = this.selection.reduce((total, [input, match]) => total + match.length, 0)
      return Math.min(20, length + (this.includeHeaders ? 1 : 0));
    },
    columnList: function () {
      return Object.keys(COLS);
    },
    tsvColumns: function() {
      return Object.keys(COLS_TSV);
    },
    ehriVocabularies: function() {
      return Object.entries(EHRI_VOCABULARIES);
    }
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
    downloadTSVForEHRIPortal: function (filename) {
      let element = document.createElement('a');
      element.setAttribute('href', 'data:text/tsv;charset=utf-8,' + encodeURIComponent(this.tsv));
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
    copyTsv: function () {
      let elem = document.getElementById("output-data-tsv");
      elem.select();
      document.execCommand("copy");
    },
    columnLabel: function (key) {
      return COLS[key];
    },
  },
  template: `
    <section id="output" v-show="hasMatches">
      <div id="output-csv">
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
      </div>
      <div id="output-tsv">
        <button class="button is-pulled-right is-info" v-on:click="downloadTSVForEHRIPortal('coreference-table.tsv')">
          <span class="icon is-small">
            <i class="fa fa-download"></i>
          </span>
          <span>Download</span>
        </button>
        <h3 class="subtitle is-3">TSV for EHRI portal</h3>
        <textarea class="textarea" v-bind:rows="boxSize"
            readonly id="output-data-tsv" v-on:click="copyTsv">{{tsv}}</textarea>
      </div>
    </section>
  `
});

new Vue({
  el: '#app',
  data: {
    data: "",
    vocabularies: "",
    algorithm: "Levenshtein",
    threshold: 5.0,
    type: "Distance",
    results: [],
    selected: [],
    loading: false,
    progress: 0
  },
  computed: {
    entities: function () {
      return this.data.trim().split("\n").filter(e => e.trim() !== "");
    },
    hasMatches: function () {
      return this.results.filter(r => r[1].length > 0).length > 0;
    },
    selection: function () {
      return this.results.map((r, i) => {
        let [input, matches] = r;
        let selectedData = this.selected;
        let matching = matches.filter(function(value, index) {
          return selectedData !== undefined && selectedData
                .filter(s => s !== null)
                .some(([i, v]) => i === input && v === index);
        });
        return [input, matching];
      });
    }
  },
  methods: {
    find: function () {
      this.loading = true;
      let socketUrl = jsRoutes.controllers.HomeController.findWS(this.vocabularies, this.algorithm, this.threshold).webSocketURL(HTTPS);
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
          let [input, _] = this.results[0];
          this.selected[this.results.length - 1] = [input, 0];
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
    selectResult: function (input, ridx) {
      if (this.isSelected(input, ridx)) {
        let index = this.selected
          .findIndex(([i, v]) => i === input && v === ridx)
        this.selected.splice(index, 1, null);
        this.selected = this.selected.filter(s => s !== null);
      } else {
        this.selected.push([input, ridx]);
      }
    },
    clearResult: function (idx) {
      let [input, _] = this.results[idx];
      this.results.splice(idx, 1, [input, []]);
      this.selected.splice(idx, 1);
    },
    isSelected: function (input, ridx) {
      return this.selected
        .filter(s => s !== null)
        .some(([i, v]) => i === input && v === ridx);
    },
  },
  template: `
    <div id="subject-matcher">
      <div id="main-content" class="is-full">
        <div id="controls">
          <div class="field">
            <textarea class="textarea" rows="5" v-model="data" placeholder="Paste references here, one item per line..."></textarea>
          </div>
          <div class="field">
            <textarea class="textarea" rows="2" v-model="vocabularies" placeholder="Paste the URL(s) to the SKOS vocabularies here, one item per line..."></textarea>
          </div>
          <progress class="progress is-info" v-bind:value="progress" max="100"></progress>
          <div class="field">
            <label for="algorithm">Choose an algorithm:</label>
            <select name="algorithm" id="algorithm">
              <option value="Levenshtein">Levenshtein</option>
              <option value="Damerau-Levenshtein">Damerau-Levenshtein</option>
              <option value="Hamming">Hamming</option>
              <option value="LongestCommonSubsequence">LongestCommonSubsequence</option>
            </select>
          </div>
          <div class="field" v-bind:disabled="data.trim() === '' || vocabularies.trim() === ''">
            <button class="button is-primary" 
                v-bind:disabled="data.trim() === ''" v-on:click="find"
                v-bind:class="{'is-loading': loading}">
                <span class="icon is-small">
                  <i class="fa fa-search"></i>
                </span>
                <span>Find Matches</span>
            </button>
          </div>
        </div>
       
        <div id="all-match-results" v-if="results.length">
          <div class="match-results" v-for="([input, matches], idx) in results">
            <h3 class="title is-4">Input: &quot;{{input}}&quot;</h3>
            <table class="table is-fullwidth is-narrow is-bordered is-hoverable" v-if="matches.length > 0" id="results">
              <thead>
                <tr>
                    <th>Label</th>
                    <th>Term label</th>
                    <th>Language</th>
                    <th>Term</th>
                    <th>Confidence</th>
                    <th>
                        <span class="tag" v-on:click="clearResult(idx)">
                         Clear
                         <button class="delete is-small"></button>
                        </span>
                    </th>
                </tr>
              </thead>
              <tbody v-if="matches.length > 0">
                <tr v-for="(result, ridx) in matches" v-on:click="selectResult(input, ridx)">
                   <td>{{result.label}}</td>
                   <td>{{result.termLabel}}</td>
                   <td>{{result.language}}</td>
                   <td>{{result.term}}</td>
                   <td>{{result.confidence}}</td>
                   <td>
                    <a class="button" v-bind:class="{'is-success': isSelected(input, ridx)}">
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
      <article id="sidebar">
        <output-data v-if="hasMatches"
          v-bind:has-matches="hasMatches" 
          v-bind:selection="selection" />
        <docs v-else />
      </article>
    </div>
  `
});