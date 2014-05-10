// simulates any number of concurrent users of our heroku site

var NUM_USERS = parseInt(process.argv[2]);
var TEST_DURATION = 1000 * parseInt(process.argv[3]);
if (! (NUM_USERS > 0) || !(TEST_DURATION > 0)) {
  console.log("invalid arguments", process.argv);
  process.exit();
}

// pull in libraries
var http = require("http");
http.globalAgent.maxSockets = Infinity;

// main entry point
function main() {
  // create clients
  var clients = [];
  var results = {};
  for (var i = 0; i < NUM_USERS; i += 1) {
    clients.push(new Client(results));
  }

  function startClients() {
    clients.forEach(function(client) {
      client.start();
    });
  }

  function stopClients() {
    clients.forEach(function(client) {
      client.stop();
    });
  }

  function printResults() {
    var totalLatency = 0;
    var numReceivedCommits = 0;
    var numSentCommits = 0;
    for (var id in results) {
      var sendTime = parseInt(id);
      numSentCommits += 1;
      results[id].forEach(function(receiveTime) {
        var latency = receiveTime - sendTime;
        totalLatency += latency;
        numReceivedCommits += 1;
      });
    }
    var meanLatency = parseInt(totalLatency / numReceivedCommits);
    console.log("sent commits:", numSentCommits);
    console.log("received commits:", numReceivedCommits);
    console.log("mean latency:", meanLatency, "(ms)");
  }

  console.log("start time:", new  Date())
  startClients();
  setTimeout(function() {
    stopClients();
    printResults();
    console.log("end time:", new  Date())
    process.exit();
  }, TEST_DURATION);
}

var errTimeout = 2000;
var hostname = "pad-web.herokuapp.com";
var port = 80;

// class which simulates HTTP requests a real client would make. expects results
// to be a shared dictionary used by all clients to update the latency of
// receiving a particular commit.
function Client(results) {

  var paused = true;
  var nextCommit = 1;
  var clientID = parseInt(Math.random() * (+ new Date()));
  var docID = "testing @ " + (+ new Date());
  listen();

  this.start = function() {
    paused = false;
    sendCommit();
  };

  this.stop = function() {
    paused = true;
  };

  function sendCommit() {
    var id = (+ new Date());
    var commit = {
      clientID: clientID,
      parent: nextCommit - 1,
      diff: [],
      id: id,
      docID: docID,
    };
    results[id] = [];
    function doPut() {
      var options = {
        hostname: hostname,
        port: port,
        path: "/commits/put",
        method: "PUT",
        headers: {
          "doc-id": docID,
        },
      };
      var req = http.request(options);
      req.write(JSON.stringify(commit));
      req.end();
      req.on("response", function(res) {
        if (res.statusCode !== 200) {
          console.log("put status", res.statusCode);
          setTimeout(doPut, errTimeout);
        }
      }).on("error", function(err) {
        console.log("put error", err);
        setTimeout(doPut, errTimeout);
      });
    }
    doPut();
  };

  function listen() {
    function doGet() {
      var options = {
        hostname: hostname,
        port: port,
        path: "/commits/get",
        headers: {
          "doc-id": docID,
          "next-commit": nextCommit,
        },
      };
      http.get(options, function(res) {
        if (res.statusCode !== 200) {
          var errorText = "";
          res.on("data", function(chunk) {
            errorText += chunk;
          });
          res.on("end", function() {
            console.log("get status", res.statusCode)
            console.log(errorText);
            setTimeout(doGet, errTimeout);
          });
        } else {
          var commitText = "";
          res.on("data", function(chunk) {
            commitText += chunk;
          });
          res.on("end", function() {
            var commit = JSON.parse(commitText);
            if (commit.parent != nextCommit - 1) {
              console.log("bad commit received")
              console.log("expected parent", nextCommit - 1)
              console.log("received commit", commit);
              throw "boo wendy";
            } else {
              if (!(commit.id in results)) {
                return;
              }
              results[commit.id].push(+ new Date());
              nextCommit += 1;
              listen();
              if (!paused && commit.clientID === clientID) {
                sendCommit();
              }
            }
          })
        }
      }).on("error", function(err) {
        console.log("get error", err);
        setTimeout(doGet, errTimeout);
      });
    }
    doGet();
  }
}

// run this test only if it's actually be executed
if (require.main === module) {
  main();
}
