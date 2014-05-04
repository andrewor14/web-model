/* -------------------- *
 * Logic for index.html *
 * -------------------- */

jQuery.noConflict();

document.observe('dom:loaded', function () {
  initialize()
});


/*
 * Global variables.
 */

var initialized = false;

var parameterValues = {
  numControllers: 3,
  numSwitches: 20,
  iterations: 1000,
  ralpha: 3.8,
  rxmin: 1.55,
  walpha: 3.35,
  wxmin: 1.68,
  psalpha: 2.5,
  psxmin: 0.5,
  pcalpha: 2.5,
  pcxmin: 0.5
};

var defaultTopologies = {
  "Mesh": MeshTopology,
  "Ring": RingTopology,
  "Star": StarTopology,
  "Fat-tree": FatTreeTopology
};

var currentTopology = Object.keys(defaultTopologies)[0];


/*
 * Initialize all HTML elements.
 */

function initialize() {
  constructSliders();
  constructTopologyDropdown();
  editNumSwitches(parameterValues.numSwitches);
  editNumControllers(parameterValues.numControllers);
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

/*
 * Construct all sliders.
 */
function constructSliders() {
  constructNumElementsSlider(parameterValues.numSwitches);
  jQuery("#num-controllers-slider").slider({
    min: 1,
    max: 10,
    value: parameterValues.numControllers,
    change: function (event, ui) {
      editNumControllers(ui.value)
    }
  })
  jQuery("#iterations-slider").slider({
    min: 10,
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

/*
 * Construct the slider representing the number of switches or pods.
 */
function constructNumElementsSlider(startingValue) {
  if (jQuery("#num-elements-key").text() == "Number of switches: ") {
    jQuery("#num-elements-slider").slider({
      min: 2,
      max: 45,
      step: 1,
      value: startingValue,
      change: function (event, ui) {
        editNumElements(ui.value);
      }
    });
    jQuery("#num-elements-slider").removeClass("right-slider-short");
    jQuery("#num-elements-slider").addClass("right-slider");
  }
  if (jQuery("#num-elements-key").text() == "Number of pods: ") {
    jQuery("#num-elements-slider").slider({
      min: 2,
      max: 6,
      step: 2,
      value: startingValue,
      change: function (event, ui) {
        editNumElements(ui.value);
      }
    });
    jQuery("#num-elements-slider").removeClass("right-slider");
    jQuery("#num-elements-slider").addClass("right-slider-short");
  }
}

/*
 * Construct the dropdown menu representing the choice of topology.
 */
function constructTopologyDropdown() {
  jQuery.each(defaultTopologies, function(name, topology) {
    jQuery("<option></option>")
      .appendTo("#topology-dropdown")
      .attr("value", name)
      .text(name);
  });
  jQuery("#topology-dropdown").change(function() {
    currentTopology = jQuery(this).val();
    // If topology is fat-tree display number of pods; else, display number of switches
    jQuery("#num-elements-key").text(function(i, oldKey) {
      // If the existing element refers to switches, convert this number to pods
      if (isFatTree(currentTopology) && oldKey == "Number of switches: ") {
        jQuery("#num-elements-key").text("Number of pods: ")
        jQuery("#num-elements-value").text(function(j, oldValue) {
          var numSwitches = parseInt(oldValue);
          var numPods = switchesToPods(numSwitches);
          constructNumElementsSlider(numPods)
          return numPods;
        })
      }
      // If the existing element refers to pods, convert this number to switches
      if (!isFatTree(currentTopology) && oldKey == "Number of pods: ") {
        jQuery("#num-elements-key").text("Number of switches: ")
        jQuery("#num-elements-value").text(function(j, oldValue) {
          var numPods = parseInt(oldValue);
          var numSwitches = podsToSwitches(numPods);
          constructNumElementsSlider(numSwitches);
          return numSwitches;
        });
      }
    });
    updateConvergenceTime();
  });
}

/*
 * Return whether the given topology name refers to fat-trees.
 */
function isFatTree(topologyName) {
  return topologyName.indexOf("Fat-tree") >= 0 || topologyName.indexOf("fat-tree") >= 0
}

/*
 * Generate convergence time data points.
 */

function DataContainer(numSwitches, links) {
  this.numControllers = parameterValues.numControllers;
  this.numSwitches = numSwitches;
  this.links = links;
  this.iterations = parameterValues.iterations
  this.ralpha = parameterValues.ralpha
  this.rxmin = parameterValues.rxmin
  this.walpha = parameterValues.walpha
  this.wxmin = parameterValues.wxmin
  this.psalpha = parameterValues.psalpha
  this.pcalpha = parameterValues.pcalpha
  this.psxmin = parameterValues.psxmin
  this.pcxmin = parameterValues.pcxmin

  function computeSamples(replicationScheme) {
    return replicationScheme(this.numCoreSwitchesToUpdate, this.numControllers, this.walpha,
      this.ralpha, this.pcalpha, this.psalpha, this.wxmin, this.rxmin, this.pcxmin, this.psxmin,
      this.iterations);
  }

  this.compute = function() {
    var noCtrl = noController(this.srcToRemove, this.destToRemove, this.afterMatrix,
      this.coreSwitchesToUpdate, this.walpha, this.ralpha, this.pcalpha, this.psalpha, this.wxmin,
      this.rxmin, this.pcxmin, this.psxmin, this.iterations);
    this.traditionalTimes = noCtrl
    this.traditionalCdf = computeCdf(noCtrl);
    this.singleSamples = computeSamples(singleController);
    this.onepcSamples = computeSamples(onePhaseCommit);
    this.twopcSamples = computeSamples(twoPhaseCommit);
    this.paxosSamples = computeSamples(paxosCommit);
    this.singleTimes = this.singleSamples.map(function(v){ return v[0] });
    this.onepcTimes = this.onepcSamples.map(function(v){ return v[0] });
    this.twopcTimes = this.twopcSamples.map(function(v){ return v[0] });
    this.paxosTimes = this.paxosSamples.map(function(v){ return v[0] });
    this.singleCdf = computeCdf(this.singleTimes);
    this.onepcCdf = computeCdf(this.onepcTimes);
    this.twopcCdf = computeCdf(this.twopcTimes);
    this.paxosCdf = computeCdf(this.paxosTimes);
  }

  /*
   * Remove a link to cause a link down event.
   * This is the event that induces a re-convergence of routing state in the network.
   */
  this.removeLink = function() {
    if (this.links.length == 0) return;
    // Construct before and after network configurations
    var beforeLinks = this.links;
    var afterLinks = this.links.slice(0);
    var linkToRemove = this.links[Math.floor(Math.random() * this.links.length)];
    var srcToRemove = linkToRemove.src;
    var destToRemove = linkToRemove.dest;
    for (var i = this.links.length - 1; i >= 0; i--) {
      var link = afterLinks[i];
      if ((link.src == srcToRemove && link.dest == destToRemove) ||
          (link.src == destToRemove && link.dest == srcToRemove)) {
        afterLinks.splice(i, 1);
      }
    }
    this.srcToRemove = srcToRemove;
    this.destToRemove = destToRemove;
    this.beforeMatrix = convergedLinkMatrix(this.numSwitches, beforeLinks);
    this.afterMatrix = convergedLinkMatrix(this.numSwitches, afterLinks);
    this.coreSwitchesToUpdate = switchesToUpdate(this.beforeMatrix, this.afterMatrix);
    this.numCoreSwitchesToUpdate = this.coreSwitchesToUpdate.length;
    // Don't update the ingress switch until the atomic commit point
    if (this.consistentUpdates) {
      if (this.numCoreSwitchesToUpdate != 0) {
        this.numEdgeSwitchesToUpdate = 1;
        this.numCoreSwitchesToUpdate -= 1;
      } else {
        // Already converged (although controllers do run replication scheme to decide this,
        // the network itself is already converged)
        this.numEdgeSwitchesToUpdate = 0;
      }
    }
  }

  this.removeLink();
  this.compute();
  return this;
}


/*
 * Reflect updated statistics in HTML.
 */

function updateConvergenceTime() {
  var numSwitches = parameterValues.numSwitches;
  var topology = new defaultTopologies[currentTopology](numSwitches);
  var data = DataContainer(topology.numSwitches, topology.links);
  updateConvergencePercentiles(data);
  drawConvergenceCdf(data);
}

function updateConvergencePercentiles(data) {
  jQuery("#traditional_latency50pct").text(
    roundNumber(calculatePercentile(data.traditionalTimes, 0.5), 2));
  jQuery("#traditional_latency999pct").text(
    roundNumber(calculatePercentile(data.traditionalTimes, 0.999), 2));
  jQuery("#single_latency50pct").text(
    roundNumber(calculatePercentile(data.singleTimes, 0.5), 2));
  jQuery("#single_latency999pct").text(
    roundNumber(calculatePercentile(data.singleTimes, 0.999), 2));
  jQuery("#onepc_latency50pct").text(
    roundNumber(calculatePercentile(data.onepcTimes, 0.5), 2));
  jQuery("#twopc_latency50pct").text(
    roundNumber(calculatePercentile(data.twopcTimes, 0.5), 2));
  jQuery("#paxos_latency50pct").text(
    roundNumber(calculatePercentile(data.paxosTimes, 0.5), 2));
  jQuery("#onepc_latency999pct").text(
    roundNumber(calculatePercentile(data.onepcTimes, 0.999), 2));
  jQuery("#twopc_latency999pct").text(
    roundNumber(calculatePercentile(data.twopcTimes, 0.999), 2));
  jQuery("#paxos_latency999pct").text(
    roundNumber(calculatePercentile(data.paxosTimes, 0.999), 2));
}

function updateReadLatencyPercentiles() {
  var alpha = parameterValues.ralpha
  var xmin = parameterValues.rxmin
  jQuery("#rlatency50pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.5), 2));
  jQuery("#rlatency999pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.999), 2));
}

function updateWriteLatencyPercentiles() {
  var alpha = parameterValues.walpha
  var xmin = parameterValues.wxmin
  jQuery("#wlatency50pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.5), 2));
  jQuery("#wlatency999pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.999), 2));
}

function updateSwitchNetworkLatencyPercentiles() {
  var alpha = parameterValues.psalpha
  var xmin = parameterValues.psxmin
  jQuery("#pslatency50pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.5), 2));
  jQuery("#pslatency999pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.999), 2));
}

function updateControllerNetworkLatencyPercentiles() {
  var alpha = parameterValues.pcalpha
  var xmin = parameterValues.pcxmin
  jQuery("#pclatency50pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.5), 2));
  jQuery("#pclatency999pct").text(
    roundNumber(calculateParetoPercentile(alpha, xmin, 0.999), 2));
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

function editNumSwitches(numSwitches) {
  jQuery("#num-elements-key").text("Number of switches: ");
  editNumElements(numSwitches);
}

function editNumElements(numElements) {
  jQuery("#num-elements-value").text(numElements);
  if (jQuery("#num-elements-key").text() == "Number of pods: ") {
    parameterValues.numSwitches = podsToSwitches(numElements);
  } else {
    parameterValues.numSwitches = numElements;
  }
  if (initialized) {
    updateConvergenceTime();
  }
}

function editNumControllers(numControllers) {
  jQuery("#num-controllers-value").text(numControllers);
  parameterValues.numControllers = numControllers;
  if (initialized) {
    updateConvergenceTime();
  }
}

function editIterations(iterations) {
  jQuery("#iterations-value").text(iterations);
  parameterValues.iterations = iterations;
  if (initialized) {
    updateConvergenceTime();
  }
}

function editRAlpha(alpha) {
  jQuery("#ralpha-value").text(alpha);
  parameterValues.ralpha = alpha;
  if (initialized) {
    updateReadLatencyPercentiles();
    drawReadLatencyCDF();
    updateConvergenceTime();
  }
}

function editRXmin(xmin) {
  jQuery("#rxmin-value").text(xmin);
  parameterValues.rxmin = xmin
  if (initialized) {
    updateReadLatencyPercentiles();
    drawReadLatencyCDF();
    updateConvergenceTime();
  }
}

function editWAlpha(alpha) {
  jQuery("#walpha-value").text(alpha);
  parameterValues.walpha = alpha;
  if (initialized) {
    updateWriteLatencyPercentiles();
    drawWriteLatencyCDF();
    updateConvergenceTime();
  }
}

function editWXmin(xmin) {
  jQuery("#wxmin-value").text(xmin);
  parameterValues.wxmin = xmin;
  if (initialized) {
    updateWriteLatencyPercentiles();
    drawWriteLatencyCDF();
    updateConvergenceTime();
  }
}

function editPsAlpha(alpha) {
  jQuery("#psalpha-value").text(alpha);
  parameterValues.psalpha = alpha;
  if (initialized) {
    updateSwitchNetworkLatencyPercentiles();
    drawSwitchNetworkLatencyCDF();
    updateConvergenceTime();
  }
}

function editPsXmin(xmin) {
  jQuery("#psxmin-value").text(xmin);
  parameterValues.psxmin = xmin
  if (initialized) {
    updateSwitchNetworkLatencyPercentiles();
    drawSwitchNetworkLatencyCDF();
    updateConvergenceTime();
  }
}

function editPcAlpha(alpha) {
  jQuery("#pcalpha-value").text(alpha);
  parameterValues.pcalpha = alpha
  if (initialized) {
    updateControllerNetworkLatencyPercentiles();
    drawControllerNetworkLatencyCDF();
    updateConvergenceTime();
  }
}

function editPcXmin(xmin) {
  jQuery("#pcxmin-value").text(xmin);
  parameterValues.pcxmin = xmin
  if (initialized) {
    updateControllerNetworkLatencyPercentiles();
    drawControllerNetworkLatencyCDF();
    updateConvergenceTime();
  }
}


/*
 * Draw each CDF using Flotr.
 */

function drawParetoCDF(alpha, xmin, container) {
  var data = [];
  for (var i = 0; i < 32; i += 0.5) {
    data.push([i, calcParetoCdf(alpha, xmin, i)]);
  }
  Flotr.draw($(container), [data], {
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

function drawConvergenceCdf(data) {
  Flotr.draw(
    $('tcdf'), [{
      data: data.traditionalCdf,
      label: 'Fully Distributed',
      color: 'blue'
    }, {
      data: data.singleCdf,
      label: 'Single Controller',
      color: 'red'
    }, {
      data: data.onepcCdf,
      label: 'Master/Backup(s) with One-Phase Commit',
      color: '#c4e5c1'
    }, {
      data: data.twopcCdf,
      label: 'Master/Backup(s) with Two-Phase Commit',
      color: '#e988a1'
    }, {
      data: data.paxosCdf,
      label: 'Paxos Replicated State Machines',
      color: '#6dc066'
    }], {
      legend: {
        position: 'se',
        margin: 30
      },
      xaxis: {
        max: 30,
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
