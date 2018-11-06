let app = new Vue({
  el: '#app',
  data: {
    data: "",
    results: []
  },
  computed: {
    csv: function() {
      let text = "";
      this.results.forEach((r, i) => {
        let [input, matches] = r;
        if (matches.length > 0) {
          let match = matches[0];
          text += [match.name, match.lat ? match.lat : "",
          match.lng ? match.lng : ""].join(",") + "\n"
        }
      });
      return text;
    }
  },
  methods: {
    find: function () {
      let socketUrl = "ws://localhost:9000/findWS";
      let socket = new WebSocket(socketUrl);
      this.results = [];
      socket.addEventListener('open', e => {
        socket.send(this.data);
      });
      socket.addEventListener("message", e => {
        let data = JSON.parse(e.data)
        this.results.push(data);
      });
      socket.addEventListener("close", e => {
        console.log("Closed socket...");
      });
    },
    deleteResult: function(idx, ridx) {
      let newResults = [];
      this.results.forEach((r, i) => {
        if (i !== idx) {
          newResults.push(r)
        } else {
          let [input, newMatches] = r;
          newMatches.splice(ridx, 1);
          newResults.push([input, newMatches]);
        }
      });
      this.results = newResults;
    }
  },
  template: `
    <div id="subject-matcher">
      <h2>List subjects one per line in the text box:</h2>
      <div class="field">
        <textarea rows="10" v-model="data"></textarea>
      </div>
      <div class="field">
        <button v-on:click="find">Find Matches</button>
      </div> 
      <hr/>
      
      <div v-for="([input, matches], idx) in results">
        <h3>Input: &quot;{{input}}&quot;</h3>
        <table v-if="matches.length > 0" id="results">
          <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Name</th>
              <th>Alt. Names</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th></th>
          </tr>
          <tr v-for="(result, ridx) in matches">
             <td>{{result.id}}</td>
             <td>{{result.type}}</td>
             <td>{{result.name}}</td>
             <td>{{result.alternateNames ? result.alternateNames.slice(0, 4).join(", ") : ""}}</td>
             <td>{{result.lat}}</td>
             <td>{{result.lng}}</td>
             <td><span v-on:click="deleteResult(idx, ridx)">x</span></td>
          </tr>
        </table>
        <span v-else>No Matches</span>
      </div>
      <hr/>
      <pre>{{csv}}</pre>
    </div>
  `
});