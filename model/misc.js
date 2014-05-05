// Copyright 2012-2013 Peter Bailis
// Copyright 2012-2013 Colin Scott
// Copyright 2012-2013 Andrew Or

/* ============================== *
 * Miscellaneous helper functions *
 * ============================== /

/* Draw a random sample from the given Exponential distribution */
function nextExponential(lmbda) {
  return Math.log((1 - Math.random()) / lmbda) / (-lmbda);
}

/* Draw a random sample from the given Pareto distribution */
function nextPareto(alpha, xmin) {
  return Math.pow(alpha * Math.pow(xmin, alpha) / (1 - Math.random()), 1 / (alpha + 1));
}

function calcExponentialPdf(lmbda, t) {
  return lmbda * Math.exp(-lmbda * t);
}

function calcExponentialCdf(lmbda, t) {
  return 1 - Math.exp(-lmbda * t);
}

function calcExponentialExpected(lmbda) {
  return 1 / lmbda;
}

function calcParetoPdf(alpha, xmin, t) {
  if (t < xmin){
    return 0;
  }
  return alpha * Math.pow(xmin, alpha) / Math.pow(t, (alpha + 1));
}

function calcParetoCdf(alpha, xmin, t) {
  if (t < xmin){
    return 0;
  }
  return 1 - Math.pow(xmin / t, alpha);
}

function calcParetoExpected(alpha, xmin) {
  if (t <= 1){
    return Infinity;
  }
  return alpha * xmin / (alpha - 1)
}

/* Compute a list of CDF points based on a set of raw data points */
function computeCdf(datapoints) {
  var cdf = new Array();
  datapoints = sortFloats(datapoints);
  var len = datapoints.length;
  var step = 1.0 / len;
  var cumulative = 0.0;
  for (var i = 0; i < len; i++) {
    var x = datapoints[i];
    cumulative += step;
    var y = cumulative;
    cdf.push([x, y]);
  }
  return cdf;
}

/* Calculates a percentile value of any given distribution */
function calculatePercentile(datapoints, pctile) {
  if (datapoints.length == 0) {
    return 0;
  }
  return sortFloats(datapoints)[Math.floor(datapoints.length * pctile)];
}

/* Calculates a percentile value of a given Pareto distribution */
function calculateParetoPercentile(alpha, xmin, pctile) {
  var iterations = Math.min(Math.max(10000.0, 1 / (1 - pctile)), 100000.0);
  var latencies = [];
  for (var i = 0; i < iterations; i++) {
    latencies.push(nextPareto(alpha, xmin));
  }
  return calculatePercentile(latencies, pctile);
}

function sortFloats(l) {
  return l.sort(function(a, b) {
    return a - b;
  });
}

function roundNumber(num, dec) {
  var result = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  return result;
}

