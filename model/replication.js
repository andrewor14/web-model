// Copyright 2012-2013 Peter Bailis
// Copyright 2012-2013 Colin Scott
// Copyright 2012-2013 Andrew Or

/*
  N: number of replicas
  Q: number of replicas to wait from before committing

  {W, R, Pc, Ps}{_alpha, _xmin}: parameters describing the message
  delays. In this implementation, they're Pareto distributed, but
  this needs not be the case.  See the paper or the site for more
  description.
*/

function no_controller(src_to_remove, dest_to_remove, after_matrix, switches_to_update,
  W_alpha, R_alpha, Pc_alpha, Ps_alpha, W_xmin, R_xmin, Pc_xmin, Ps_xmin, iterations) {

  /*
   * Traditional link-state routing through flooding
   *
   * This implementation is given a single failed link, and
   * computes the convergence time for a network with traditional
   * routing (no controllers) to recover. Essentially, this means
   * that we flood our link map to all other switches in parallel,
   * and compute the maximum distance from us to any other node in the
   * network.
   *
   * TODO(cs): account for additional intermediate link failures
   *
   * Requires ./floyd-warshall.js
   */

  var src = src_to_remove - 1;
  var dest = dest_to_remove - 1;

  var datapoints = new Array();
  for (var i = 0; i < iterations; i++) {
    // Find the max number of hops to any other node
    var src_max_hops = Number.NEGATIVE_INFINITY;
    var dest_max_hops = Number.NEGATIVE_INFINITY;
    for (var j = 0; j < switches_to_update.length; j++){
      var src_hops = links_on_path(src, switches_to_update[j], after_matrix).length;
      var dest_hops = links_on_path(dest, switches_to_update[j], after_matrix).length;
      if (src_hops > src_max_hops) {
        src_max_hops = src_hops;
      }
      if (dest_hops > dest_max_hops) {
        dest_max_hops = dest_hops;
      }
    }
    // Find the max of the two latencies
    var src_latency = 0;
    var dest_latency = 0;
    for (var s = 0; s < src_max_hops; s++) {
      src_latency += nextPareto(Ps_alpha, Ps_xmin);  // TODO(ao): Incorrect use of Ps
    }
    for (var d = 0; d < dest_max_hops; d++) {
      dest_latency += nextPareto(Ps_alpha, Ps_xmin); // TODO(ao): Incorrect use of Ps
    }
    datapoints.push(Math.max(src_latency, dest_latency));
  }

  return datapoints;
}

function single_controller(S, N, W_alpha, R_alpha, Pc_alpha, Ps_alpha, W_xmin, R_xmin,
  Pc_xmin, Ps_xmin, iterations) {

  /*
   * Replication scheme: Single Controller
   *
   * In this simple replication scheme, the controller computes a value,
   *   commits, and forwards result to all client switches
   */
  if (N != 1) {
    // For comparison purposes, ignore N
  }
  
  var datapoints = new Array();
  for (var i = 0; i < iterations; i++) {
    var total_latency = 0;
    var controller_overhead = 0;
    var exchange_overhead = 0;
    controller_overhead += nextPareto(Ps_alpha, Ps_xmin);
    exchange_overhead += nextPareto(W_alpha, W_xmin);

    var network_update_latencies = new Array();
    for (var j = 0; j < S; j++) {
      network_update_latencies.push(nextPareto(Ps_alpha, Ps_xmin));
    }
    if (S != 0) {
      controller_overhead += Math.max.apply(null, network_update_latencies);
    }
    total_latency += controller_overhead
    total_latency += exchange_overhead
    datapoints.push([total_latency, controller_overhead, exchange_overhead])
  }
  return datapoints;
}

function one_phase_commit(S, N, W_alpha, R_alpha, Pc_alpha, Ps_alpha, W_xmin, R_xmin,
  Pc_xmin, Ps_xmin, iterations) {

  /*
   * Replication scheme: One-Phase Commit with 1 Master and N-1 Backups
   *
   * In One-Phase Commit,
   *   (A1) Proposer (Backup) forwards a request to Master
   *   (A2) Master sends requests to all Backups
   *   (A3) Proposer commits locally and forwards result to all client switches
   *        (Q Backups respond with ACKs)
   *
   * With co-location, this becomes
   *   (B1) Master sends requests to all Backups
   *   (B2) Q Backups commit locally and respond with ACKs
   *   (B3) Master commits locally and forwards result to all client switches
   */
  if (N <= 1) {
    return [];
  }
  var Q = Math.floor(N/2)+1;

  var datapoints = new Array();
  for (var i = 0; i < iterations; i++) {
    var total_latency = 0
    var controller_overhead = 0
    var exchange_overhead = 0
    var colocation = (Math.floor(Math.random() * N) != 0);
    controller_overhead += nextPareto(Ps_alpha, Ps_xmin);

    // Phase 1: N requests, Q responses
    var request_latencies = new Array();
    var response_latencies = new Array();
    for (var j = 1; j <= N-1; j++) {
      request_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
      if (Q >= j) {
        response_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
      }
    }

    if (!colocation) {
      exchange_overhead += nextPareto(Pc_alpha, Pc_xmin);// A1
      exchange_overhead += Math.max.apply(null, request_latencies);// A2
    } else {
      exchange_overhead += Math.max.apply(null, request_latencies);// B1
      exchange_overhead += Math.max.apply(null, response_latencies);// B2
    }
    exchange_overhead += nextPareto(W_alpha, W_xmin);// A3, B3
    var network_update_latencies = new Array();
    for (var j = 0; j < S; j++) {
      network_update_latencies.push(nextPareto(Ps_alpha, Ps_xmin));
    }
    if (S != 0) {
      controller_overhead += Math.max.apply(null, network_update_latencies);
    }
    total_latency += controller_overhead
    total_latency += exchange_overhead
    datapoints.push([total_latency, controller_overhead, exchange_overhead])
  }
  return datapoints;
}

function two_phase_commit(S, N, W_alpha, R_alpha, Pc_alpha, Ps_alpha, W_xmin, R_xmin,
  Pc_xmin, Ps_xmin, iterations) {

  /*
   * Replication scheme: Two-Phase Commit with 1 Master and N-1 Backups
   *
   * In Two-Phase Commit,
   *   (A1) Proposer (Backup) forwards a request to Master
   *   (A2) Master sends Prepare requests to all Backups
   *   (A3) Q Backups respond with Prepare ACKs
   *   (A4) Master commits locally and sends Commit messages to all Backups
   *   (A5) Proposer commits locally and forwards result to all client switches
   *
   * With co-location, this becomes,
   *   (B1) Master sends Prepare requests to all Backups
   *   (B2) Q Backups respond with Prepare ACKs
   *   (B3) Master commits locally and forwards result to all client switches
   *        (Master sends Commit messages to all Backups)
   */
  if (N <= 1) {
    return [];
  }
  var Q = Math.floor(N/2)+1;

  var datapoints = new Array();
  for (var i = 0; i < iterations; i++) {
    var total_latency = 0
    var controller_overhead  = 0
    var exchange_overhead = 0
    var colocation = (Math.floor(Math.random() * N) == 0);
    controller_overhead += nextPareto(Ps_alpha, Ps_xmin);

    // Phase 1: N requests, Q responses
    var request_latencies = new Array();
    var response_latencies = new Array();
    for (var j = 1; j <= N-1; j++) {
      request_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
      if (Q >= j) {
        response_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
      }
    }

    // Phase 2: N requests
    var request_latencies2 = new Array();
    for (var j = 1; j <= N-1; j++) {
      request_latencies2.push(nextPareto(Pc_alpha, Pc_xmin));
    }

    if(!colocation) {
      exchange_overhead += nextPareto(Pc_alpha, Pc_xmin);            // A1
      exchange_overhead += Math.max.apply(null, request_latencies);  // A2
      exchange_overhead += Math.max.apply(null, response_latencies); // A3
      exchange_overhead += nextPareto(W_alpha, W_xmin);              // A4
      exchange_overhead += Math.max.apply(null, request_latencies2);
    } else {
      exchange_overhead += Math.max.apply(null, request_latencies);  // B1
      exchange_overhead += Math.max.apply(null, response_latencies); // B2
    }
    exchange_overhead += nextPareto(W_alpha, W_xmin);                // A5, B3
    var network_update_latencies = new Array();
    for (var j = 0; j < S; j++) {
      network_update_latencies.push(nextPareto(Ps_alpha, Ps_xmin));
    }
    if (S != 0) {
      controller_overhead += Math.max.apply(null, network_update_latencies);
    }
    total_latency += controller_overhead
    total_latency += exchange_overhead
    datapoints.push([total_latency, controller_overhead, exchange_overhead])
  }
  return datapoints;
}

function paxos_commit(S, N, W_alpha, R_alpha, Pc_alpha, Ps_alpha, W_xmin, R_xmin,
  Pc_xmin, Ps_xmin, iterations) {

  /*
   * Replication scheme: Paxos Commit with N total nodes
   *
   * Assumptions:
   *   We do not consider optimizations that involve eliminating the Prepare phase.
   *   We consider leader-election a one-time cost and do not factor it in our computation.
   *
   * In Paxos Commit,
   *   (A1) Proposer (Replica) forwards a request to Leader
   *   (A2) Leader sends Prepare requests to all Replicas
   *   (A3) Q Replicas respond with Prepare ACKs
   *   (A4) Leader sends Accept requests to all Replicas
   *   (A5) Q Replicas respond with Accept ACKs
   *   (A6) Leader selects a value, commits locally, and notifies all Replicas of the selected value
   *   (A7) Proposer commits locally and forwards result to all client switches
   *
   * With co-location, this becomes,
   *   (B1) Leader sends Prepare requests to all Replicas
   *   (B2) Q Backups respond with Prepare ACKs
   *   (B3) Leader sends Accept requests to all Replicas
   *   (B4) Q Backups respond with Accept ACKs
   *   (B5) Leader selects a value, commits locally, and forwards result to all client switches
   *        (Leader notifies all Replicas of the selected value)
   */
  if (N <= 1) {
    return [];
  }
  var Q = Math.floor(N/2)+1;

  var datapoints = new Array();
  for (var i = 0; i < iterations; i++) {
    var total_latency = 0
    var controller_overhead = 0
    var exchange_overhead = 0
    var colocation = (Math.floor(Math.random() * N) == 0);
    controller_overhead += nextPareto(Ps_alpha, Ps_xmin);

    // Phase 1: N requests, Q responses
    var request_latencies = new Array();
    var response_latencies = new Array();
    for (var j = 1; j <= N-1; j++) {
      request_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
      if (Q >= j) {
        response_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
      }
    }

    // Phase 2: N requests, Q responses
    var request_latencies2 = new Array();
    var response_latencies2 = new Array();
    for (var j = 1; j <= N-1; j++) {
      request_latencies2.push(nextPareto(Pc_alpha, Pc_xmin));
      if (Q >= j) {
        response_latencies2.push(nextPareto(Pc_alpha, Pc_xmin));
      }
    }

    // Phase 3: N notifications
    var notification_latencies = new Array();
    for (var j = 1; j <= N-1; j++) {
      notification_latencies.push(nextPareto(Pc_alpha, Pc_xmin));
    }

    if(!colocation) {
      exchange_overhead += nextPareto(Pc_alpha, Pc_xmin);             // A1
      exchange_overhead += Math.max.apply(null, request_latencies);   // A2
      exchange_overhead += Math.max.apply(null, response_latencies);  // A3
      exchange_overhead += Math.max.apply(null, request_latencies2);  // A4
      exchange_overhead += Math.max.apply(null, response_latencies2); // A5
      exchange_overhead += nextPareto(W_alpha, W_xmin);               // A6
      exchange_overhead += Math.max.apply(null, notification_latencies);
    } else {
      exchange_overhead += Math.max.apply(null, request_latencies);   // B1
      exchange_overhead += Math.max.apply(null, response_latencies);  // B2
      exchange_overhead += Math.max.apply(null, request_latencies2);  // B3
      exchange_overhead += Math.max.apply(null, response_latencies2); // B4
    }
    exchange_overhead += nextPareto(W_alpha, W_xmin);                 // A7, B5
    var network_update_latencies = new Array();
    for (var j = 0; j < S; j++) {
      network_update_latencies.push(nextPareto(Ps_alpha, Ps_xmin));
    }
    if (S != 0) {
      controller_overhead += Math.max.apply(null, network_update_latencies);
    }
    total_latency += controller_overhead
    total_latency += exchange_overhead
    datapoints.push([total_latency, controller_overhead, exchange_overhead])
  }
  return datapoints;
}

