/* -------------------- *
 * Logic for index.html *
 * -------------------- */

jQuery.noConflict();

document.observe('dom:loaded', function () {
  initialize()
});

var initialized = false;

var parameterValues = {
  iterations: 1000,
  ralpha: 3.8,
  rxmin: 1.55,
  walpha: 3.35,
  wxmin: 1.68,
  psalpha: 2.5,
  psxmin: 0.5,
  pcalpha: 2.5,
  pcxmin: 0.5
}

function initialize() {
  initializeSliders();
  editIterations(parameterValues.iterations);
  editRAlpha(parameterValues.ralpha);
  editRXmin(parameterValues.rxmin);
  editWAlpha(parameterValues.walpha);
  editWXmin(parameterValues.wxmin);
  editPsAlpha(parameterValues.psalpha);
  editPsXmin(parameterValues.psxmin);
  editPcAlpha(parameterValues.pcalpha);
  editPcXmin(parameterValues.pcxmin);
  updateAllParameterPercentiles();
  drawAllParameterCDFs();
  updateConvergenceTime();
  initialized = true;
}

function initializeSliders() {
  jQuery("#iterations-slider").slider({
    min: 1,
    max: 2500,
    value: parameterValues.iterations,
    change: function (event, ui) {
      editIterations(ui.value)
    }
  })
  jQuery("#ralpha-slider").slider({
    min: 100,
    max: 10000,
    value: parameterValues.ralpha * 1000,
    change: function (event, ui) {
      editRAlpha(ui.value / 1000)
    }
  });
  jQuery("#rxmin-slider").slider({
    min: 100,
    max: 5000,
    value: parameterValues.rxmin * 1000,
    change: function (event, ui) {
      editRXmin(ui.value / 1000)
    }
  });
  jQuery("#walpha-slider").slider({
    min: 1000,
    max: 10000,
    value: parameterValues.walpha * 1000,
    change: function (event, ui) {
      editWAlpha(ui.value / 1000);
    }
  });
  jQuery("#wxmin-slider").slider({
    min: 100,
    max: 5000,
    value: parameterValues.wxmin * 1000,
    change: function (event, ui) {
      editWXmin(ui.value / 1000);
    }
  });
  jQuery("#psalpha-slider").slider({
    min: 1000,
    max: 10000,
    value: parameterValues.psalpha * 1000,
    change: function (event, ui) {
      editPsAlpha(ui.value / 1000);
    }
  });
  jQuery("#psxmin-slider").slider({
    min: 100,
    max: 5000,
    value: parameterValues.psxmin * 1000,
    change: function (event, ui) {
      editPsXmin(ui.value / 1000);
    }
  });
  jQuery("#pcalpha-slider").slider({
    min: 1000,
    max: 10000,
    value: parameterValues.pcalpha * 1000,
    change: function (event, ui) {
      editPcAlpha(ui.value / 1000);
    }
  });
  jQuery("#pcxmin-slider").slider({
    min: 100,
    max: 5000,
    value: parameterValues.pcxmin * 1000,
    change: function (event, ui) {
      editPcXmin(ui.value / 1000);
    }
  });
}


// Class to give us some semblance of separation of concerns
function DataContainer(N, d3switches, d3links) {
  this.N = N;
  this.d3switches = d3switches;
  this.d3links = d3links;
  this.iterations = parameterValues.iterations
  this.R_a = parameterValues.ralpha
  this.R_x = parameterValues.rxmin
  this.W_a = parameterValues.walpha
  this.W_x = parameterValues.wxmin
  this.Ps_a = parameterValues.psalpha
  this.Pc_a = parameterValues.pcalpha
  this.Ps_x = parameterValues.psxmin
  this.Pc_x = parameterValues.pcxmin

  function computeSamples(replication_scheme) {
    return replication_scheme(this.num_core_switches_to_update, this.N, this.W_a,
      this.R_a, this.Pc_a, this.Ps_a, this.W_x, this.R_x, this.Pc_x, this.Ps_x, this.iterations);
  }

  this.compute = function() {
    // N.B. we don't apply atomic commit for traditional routing
    var no_ctrl = no_controller(this.src_to_remove, this.dest_to_remove, this.after_matrix,
      this.core_switches_to_update, this.W_a, this.R_a, this.Pc_a, this.Ps_a, this.W_x,
      this.R_x, this.Pc_x, this.Ps_x, this.iterations);
    this.traditional_times = no_ctrl
    this.traditional_cdf = compute_cdf(no_ctrl);
    this.single_samples = computeSamples(single_controller);
    this.onepc_samples = computeSamples(one_phase_commit);
    this.twopc_samples = computeSamples(two_phase_commit);
    this.paxos_samples = computeSamples(paxos_commit);
    this.single_times = this.single_samples.map(function(v){return v[0]});
    this.onepc_times = this.onepc_samples.map(function(v){return v[0]});
    this.twopc_times = this.twopc_samples.map(function(v){return v[0]});
    this.paxos_times = this.paxos_samples.map(function(v){return v[0]});
    this.single_cdf = compute_cdf(self.single_times);
    this.onepc_cdf = compute_cdf(this.onepc_times);
    this.twopc_cdf = compute_cdf(this.twopc_times);
    this.paxos_cdf = compute_cdf(this.paxos_times);
  }

  /*
   * Remove a link to cause a link down event. This is the event that induces a re-convergence
   * of routing state in the network.
   */
  this.remove_link = function() {
    if (this.d3links.length == 0) return;

    /* Construct before and after network configurations */
    var before_links = this.d3links;
    var after_links = this.d3links.slice(0);
    var link_to_remove = this.d3links[Math.floor(Math.random()*this.d3links.length)];
    var src_to_remove = link_to_remove.source.id;
    var dest_to_remove = link_to_remove.target.id;
    for (var i=this.d3links.length-1; i>=0; i--) {
      var link = after_links[i];
      if ((link.source.id == src_to_remove && link.target.id == dest_to_remove) ||
          (link.source.id == dest_to_remove && link.target.id == src_to_remove)) {
        after_links.splice(i, 1);
      }
    }
    this.src_to_remove = src_to_remove;
    this.dest_to_remove = dest_to_remove;
    this.before_matrix = converged_link_matrix(this.d3switches, before_links);
    this.after_matrix = converged_link_matrix(this.d3switches, after_links);

    this.core_switches_to_update = switches_to_update(this.before_matrix, this.after_matrix);
    this.num_core_switches_to_update = this.core_switches_to_update.length;
    // Don't update the ``ingress'' switch until the atomic commit
    // point
    if (this.consistent_updates) {
      if (this.num_core_switches_to_update != 0) {
        this.num_edge_switches_to_update = 1;
        this.num_core_switches_to_update -= 1;
      } else {
        // Already converged (although controllers do run
        // replication scheme to decide this, the network itself
        // is already converged)
        this.num_edge_switches_to_update = 0;
      }
    }
  }

  this.remove_link();
  this.compute();

  return this;
}

function updateConvergenceTime() {
  var N = 3;
  var numSwitches = 4
  var d3switches = new Array(numSwitches)
  var d3links = []
  for (var i = 1; i <= numSwitches; i++) {
    for (var j = 1; j <= numSwitches; j++) {
      if (i != j) {
        var link = {
          source: { id: i },
          target: { id: j }
        }
        d3links.push(link)
      }
    }
  }
  var data = DataContainer(N, d3switches, d3links);
  updateConvergencePercentiles(data)

  Flotr.draw(
    $('tcdf'), [{
      data: data.traditional_cdf,
      label: 'Fully Distributed',
      color: 'blue'
    }, {
      data: data.single_cdf,
      label: 'Single Controller',
      color: 'red'
    }, {
      data: data.onepc_cdf,
      label: 'Master/Backup(s) with One-Phase Commit',
      color: '#c4e5c1'
    }, {
      data: data.twopc_cdf,
      label: 'Master/Backup(s) with Two-Phase Commit',
      color: '#e988a1'
    }, {
      data: data.paxos_cdf,
      label: 'Paxos Replicated State Machines',
      color: '#6dc066'
    }], {
      legend: {
        position: 'se',
        margin: 30
      },
      yaxis: {
        autoscaleMargin: 0
      },
      mouse: {
        track: true,
        sensibility: 1,
        trackDecimals: 3,
        trackFormatter: function (obj) {
          return 't = ' + roundNumber(obj.x, 2) + ', Pr = ' + obj.y;
        }
      },
  });

  // Post-processing style
  jQuery(".flotr-legend table").css({
    "height": "100px",
    "width": "340px"
  });
  jQuery(".flotr-legend-color-box div").css({
    "border": "0px",
    "padding": "0px",
    "margin-left": "5px"
  });
  jQuery(".flotr-legend-label").css({
    "font-size": "16px",
    "color": "#444"
  });
}

/*
 * Reflect updated percentiles in HTML.
 */

function updateConvergencePercentiles(data) {
  document.getElementById("traditional_latency50pct").innerHTML =
    roundNumber(calculate_percentile(data.traditional_times, .5), 2);
  document.getElementById("traditional_latency999pct").innerHTML =
    roundNumber(calculate_percentile(data.traditional_times, .999), 2);
  document.getElementById("single_latency50pct").innerHTML =
    roundNumber(calculate_percentile(data.single_times, .5), 2);
  document.getElementById("single_latency999pct").innerHTML =
    roundNumber(calculate_percentile(data.single_times, .999), 2);
  document.getElementById("onepc_latency50pct").innerHTML =
    roundNumber(calculate_percentile(data.onepc_times, .5), 2);
  document.getElementById("twopc_latency50pct").innerHTML =
    roundNumber(calculate_percentile(data.twopc_times, .5), 2);
  document.getElementById("paxos_latency50pct").innerHTML =
    roundNumber(calculate_percentile(data.paxos_times, .5), 2);
  document.getElementById("onepc_latency999pct").innerHTML =
    roundNumber(calculate_percentile(data.onepc_times, .999), 2);
  document.getElementById("twopc_latency999pct").innerHTML =
    roundNumber(calculate_percentile(data.twopc_times, .999), 2);
  document.getElementById("paxos_latency999pct").innerHTML =
    roundNumber(calculate_percentile(data.paxos_times, .999), 2);
}

function updateReadLatencyPercentiles() {
  var alpha = parameterValues.ralpha
  var xmin = parameterValues.rxmin
  document.getElementById("rlatency50pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .5), 2);
  document.getElementById("rlatency999pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .999), 2);
}

function updateWriteLatencyPercentiles() {
  var alpha = parameterValues.walpha
  var xmin = parameterValues.wxmin
  document.getElementById("wlatency50pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .5), 2);
  document.getElementById("wlatency999pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .999), 2);
}

function updateSwitchNetworkLatencyPercentiles() {
  var alpha = parameterValues.psalpha
  var xmin = parameterValues.psxmin
  document.getElementById("pslatency50pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .5), 2);
  document.getElementById("pslatency999pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .999), 2);
}

function updateControllerNetworkLatencyPercentiles() {
  var alpha = parameterValues.pcalpha
  var xmin = parameterValues.pcxmin
  document.getElementById("pclatency50pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .5), 2);
  document.getElementById("pclatency999pct").innerHTML =
    roundNumber(calculate_pareto_percentile(alpha, xmin, .999), 2);
}

function updateAllParameterPercentiles() {
  updateReadLatencyPercentiles();
  updateWriteLatencyPercentiles();
  updateSwitchNetworkLatencyPercentiles();
  updateControllerNetworkLatencyPercentiles();
}


/*
 * Edit values of model parameters.
 */

function editIterations(iterations) {
  document.getElementById("iterations-value").innerHTML = iterations;
  parameterValues.iterations = iterations;
  if (initialized) {
    updateConvergenceTime();
  }
}

function editRAlpha(alpha) {
  document.getElementById("ralpha-value").innerHTML = alpha;
  parameterValues.ralpha = alpha;
  if (initialized) {
    updateReadLatencyPercentiles();
    drawReadLatencyCDF();
    updateConvergenceTime();
  }
}

function editRXmin(xmin) {
  document.getElementById("rxmin-value").innerHTML = xmin;
  parameterValues.rxmin = xmin
  if (initialized) {
    updateReadLatencyPercentiles();
    drawReadLatencyCDF();
    updateConvergenceTime();
  }
}

function editWAlpha(alpha) {
  document.getElementById("walpha-value").innerHTML = alpha;
  parameterValues.walpha = alpha;
  if (initialized) {
    updateWriteLatencyPercentiles();
    drawWriteLatencyCDF();
    updateConvergenceTime();
  }
}

function editWXmin(xmin) {
  document.getElementById("wxmin-value").innerHTML = xmin;
  parameterValues.wxmin = xmin;
  if (initialized) {
    updateWriteLatencyPercentiles();
    drawWriteLatencyCDF();
    updateConvergenceTime();
  }
}

function editPsAlpha(alpha) {
  document.getElementById("psalpha-value").innerHTML = alpha;
  parameterValues.psalpha = alpha;
  if (initialized) {
    updateSwitchNetworkLatencyPercentiles();
    drawSwitchNetworkLatencyCDF();
    updateConvergenceTime();
  }
}

function editPsXmin(xmin) {
  document.getElementById("psxmin-value").innerHTML = xmin;
  parameterValues.psxmin = xmin
  if (initialized) {
    updateSwitchNetworkLatencyPercentiles();
    drawSwitchNetworkLatencyCDF();
    updateConvergenceTime();
  }
}

function editPcAlpha(alpha) {
  document.getElementById("pcalpha-value").innerHTML = alpha;
  parameterValues.pcalpha = alpha
  if (initialized) {
    updateControllerNetworkLatencyPercentiles();
    drawControllerNetworkLatencyCDF();
    updateConvergenceTime();
  }
}

function editPcXmin(xmin) {
  document.getElementById("pcxmin-value").innerHTML = xmin;
  parameterValues.pcxmin = xmin
  if (initialized) {
    updateControllerNetworkLatencyPercentiles();
    drawControllerNetworkLatencyCDF();
    updateConvergenceTime();
  }
}


/*
 * Draw the CDFs of model parameters as Pareto distributions.
 */

function drawParetoCDF(alpha, xmin, container) {
  var data = [];
  for (var i = 0; i < 32; i += 0.5) {
    data.push([i, calc_pareto_cdf(alpha, xmin, i)]);
  }
  var f = Flotr.draw($(container), [data], {
    xaxis: { tickDecimals: 0 }
  });
}

function drawReadLatencyCDF() {
  drawParetoCDF(parameterValues.ralpha, parameterValues.rxmin, "rcontainer")
}

function drawWriteLatencyCDF() {
  drawParetoCDF(parameterValues.walpha, parameterValues.wxmin, "wcontainer")
}

function drawSwitchNetworkLatencyCDF() {
  drawParetoCDF(parameterValues.psalpha, parameterValues.psxmin, "pscontainer")
}

function drawControllerNetworkLatencyCDF() {
  drawParetoCDF(parameterValues.pcalpha, parameterValues.pcxmin, "pccontainer")
}

function drawAllParameterCDFs() {
  drawReadLatencyCDF();
  drawWriteLatencyCDF();
  drawSwitchNetworkLatencyCDF();
  drawControllerNetworkLatencyCDF();
}

