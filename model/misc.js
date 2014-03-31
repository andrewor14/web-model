// Copyright 2012-2013 Peter Bailis
// Copyright 2012-2013 Colin Scott
// Copyright 2012-2013 Andrew Or

var ITERATIONS = 2500.0;
var MAX_PS = 1 - 1 / ITERATIONS;

function update_max_iterations(its) {
  ITERATIONS = its;
  MAX_PS = 1 - 1 / ITERATIONS;
}

/* Draw a random sample from the given Exponential distribution */
function nextExponential(lmbda) {
  return Math.log((1 - Math.random())/lmbda) / (-lmbda);
}

/* Draw a random sample from the given Pareto distribution */
function nextPareto(alpha, xmin) {
  return Math.pow(alpha * Math.pow(xmin, alpha) / (1 - Math.random()), 1 / (alpha + 1))
}

function calc_exponential_pdf(lmbda, t) {
  return lmbda * Math.exp(-lmbda * t);
}

function calc_exponential_cdf(lmbda, t) {
  return 1 - Math.exp(-lmbda * t);
}

function calc_exponential_expected(lmbda) {
  return 1 / lmbda;
}

function calc_pareto_pdf(alpha, xmin, t) {
  if( t < xmin ){
    return 0;
  }
  return alpha * Math.pow(xmin, alpha) / Math.pow(t, (alpha + 1));
}

function calc_pareto_cdf(alpha, xmin, t) {
  if( t < xmin ){
    return 0;
  }
  return 1 - Math.pow(xmin / t, alpha);
}

function calc_pareto_expected(alpha, xmin) {
  if( t <= 1 ){
    return Infinity;
  }
  return alpha * xmin / (alpha - 1)
}

/* Compute a list of CDF points based on a set of raw data points */
function compute_cdf(datapoints) {
  var cdf = new Array();
  datapoints = sortfloats(datapoints);
  var len = datapoints.length;
  var step = 1.0 / len;
  var cumulative = 0.0;
  for (var i = 0; i < len; i++) {
    var x = datapoints[i];
    cumulative += step;
    var y = cumulative;
    cdf.push([x,y]);
  }
  return cdf;
}

/* Calculates a percentile value of any given distribution */
function calculate_percentile(datapoints, pctile){
  if( datapoints.length==0 ){
    return 0;
  }
  return sortfloats(datapoints)[Math.floor(datapoints.length * pctile)];
}

/* Calculates a percentile value of a given Pareto distribution */
function calculate_pareto_percentile(alpha, xmin, pctile) {
  var ITERATIONS = Math.max(10000.0, 1 / (1 - pctile));
  var i = 0;
  var latencies = [];
  for (i = 0; i < ITERATIONS; i++) {
    latencies.push(nextPareto(alpha, xmin))
  }
  return calculate_percentile(latencies, pctile);
}

function sortfloats(l) {
  return l.sort(function(a, b) {
    return a - b;
  });
}

function roundNumber(num, dec) {
  var result = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  return result;
}

