const storage = require("simple-storage").storage;

// add shortcut listener to all current and future windows
const wu = require("window-utils");
new wu.WindowTracker({
  onTrack: setupWindow,
  onUntrack: unsetupWindow
});

function setupWindow(window) {
  window.addEventListener("popupshowing", onPopupShowing, false);
  window.addEventListener("popupshown", onPopupShown, false);
}

function unsetupWindow(window) {
  window.removeEventListener("popupshowing", onPopupShowing, false);
  window.removeEventListener("popupshown", onPopupShown, false);
}

let pending = {};

function onPopupShowing(e) {
  let el = e.originalTarget;
  if (el.id)
    pending[el.id] = Date.now();
}

function onPopupShown(e) {
  let el = e.originalTarget;
  let id = el.id;
  if (id && pending[id]) {
    if (!storage[id])
      storage[id] = [];
    let now = Date.now();
    storage[id].push([now, now  - pending[id]]);
    delete pending[id];
  }
}

let handler = require("protocol").Handler({
  onRequest: function(request, response) {
    let stats = [];
    for (let id in storage) {
      let raw = storage[id];
      let times = raw.map(function(d) d[1]);
      let data = getStatistics(times);
      data.id = id;
      data.count = times.length;
      stats.push(data);
    }
    stats.sort(function(a, b) b.median - a.median);
    let b = "<table style='border: 1px solid black'>";
    b += "<tr style='background-color: silver;'><td>element id</td><td>count</td><td>median load time (ms)</td><td>std deviation</td></tr>";
    function renderItem(item) {
      b += "<tr><td>" + item.id + "</td>" +
           "<td>" + item.count + "</td>" +
           "<td>" + item.median + "</td>" +
           "<td>" + item.deviation + "</td></tr>";
    }
    stats.forEach(renderItem);

    response.content = b;
    response.contentType = 'text/html'
  }
});
handler.listen({ about: "response" })

/**
 * Returns an object that contains the median, mean,
 * variance and standard deviation for an array of numbers.
 */
function getStatistics(a) {
  var r = {
    median:   0,
    mean:     0,
    deviation: 0,
    variance: 0
  };

  a.sort();

  // median
  var mid = Math.floor(a.length / 2);
  r.median = Math.floor(((a.length % 2) != 0) ?
    a[mid] : (a[mid - 1] + a[mid]) / 2);

  // mean
  r.mean = Math.floor(a.reduce(function(total, val) {
    return total += val;
  })/a.length);

  // variance
  r.variance = Math.floor(a.reduce(function(total, val) {
    var diff = val - r.mean;
    return total += diff * diff;
  })/a.length);

  // standard deviation
  r.deviation = Math.floor(Math.sqrt(r.variance));

  return r;
}
