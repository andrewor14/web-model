// Copyright 2012-2013 Peter Bailis
// Copyright 2012-2013 Colin Scott
// Copyright 2012-2013 Andrew Or

/*
 * N: number of replicas
 * Q: number of replicas to wait from before committing
 *
 * {w, r, pc, ps}{alpha, xmin}: parameters describing the message
 * delays. In this implementation, they're Pareto distributed, but
 * this needs not be the case.  See the paper or the site for more
 * description.
 */

function noController(srcToRemove, destToRemove, afterMatrix, switchesToUpdate,
  walpha, ralpha, pcalpha, psalpha, wxmin, rxmin, pcxmin, psxmin, iterations) {

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

  var src = srcToRemove - 1;
  var dest = destToRemove - 1;

  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    // Find the max number of hops to any other node
    var srcMaxHops = Number.NEGATIVE_INFINITY;
    var destMaxHops = Number.NEGATIVE_INFINITY;
    for (var j = 0; j < switchesToUpdate.length; j++){
      var srcHops = linksOnPath(src, switchesToUpdate[j], afterMatrix).length;
      var destHops = linksOnPath(dest, switchesToUpdate[j], afterMatrix).length;
      if (srcHops > srcMaxHops) {
        srcMaxHops = srcHops;
      }
      if (destHops > destMaxHops) {
        destMaxHops = destHops;
      }
    }
    // Find the max of the two latencies
    var srcLatency = 0;
    var destLatency = 0;
    for (var s = 0; s < srcMaxHops; s++) {
      srcLatency += nextPareto(psalpha, psxmin);  // TODO(ao): Incorrect use of Ps
    }
    for (var d = 0; d < destMaxHops; d++) {
      destLatency += nextPareto(psalpha, psxmin); // TODO(ao): Incorrect use of Ps
    }
    datapoints.push(Math.max(srcLatency, destLatency));
  }

  return datapoints;
}

function singleController(S, N, walpha, ralpha, pcalpha, psalpha, wxmin, rxmin,
  pcxmin, psxmin, iterations) {

  /*
   * Replication scheme: Single Controller
   *
   * In this simple replication scheme, the controller computes a value,
   *   commits, and forwards result to all client switches
   */
  if (N != 1) {
    // For comparison purposes, ignore N
  }
  
  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0;
    var controllerOverhead = 0;
    var exchangeOverhead = 0;
    controllerOverhead += nextPareto(psalpha, psxmin);
    exchangeOverhead += nextPareto(walpha, wxmin);

    var network_updateLatencies = [];
    for (var j = 0; j < S; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (S != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

function onePhaseCommit(S, N, walpha, ralpha, pcalpha, psalpha, wxmin, rxmin,
  pcxmin, psxmin, iterations) {

  /*
   * Replication scheme: One-Phase Commit with 1 Master and N - 1 Backups
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
  var Q = Math.floor(N / 2) + 1;

  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0
    var controllerOverhead = 0
    var exchangeOverhead = 0
    var colocation = (Math.floor(Math.random() * N) != 0);
    controllerOverhead += nextPareto(psalpha, psxmin);

    // Phase 1: N requests, Q responses
    var requestLatencies = [];
    var responseLatencies = [];
    for (var j = 1; j <= N - 1; j++) {
      requestLatencies.push(nextPareto(pcalpha, pcxmin));
      if (Q >= j) {
        responseLatencies.push(nextPareto(pcalpha, pcxmin));
      }
    }

    if (!colocation) {
      exchangeOverhead += nextPareto(pcalpha, pcxmin);             // A1
      exchangeOverhead += Math.max.apply(null, requestLatencies);  // A2
    } else {
      exchangeOverhead += Math.max.apply(null, requestLatencies);  // B1
      exchangeOverhead += Math.max.apply(null, responseLatencies); // B2
    }
    exchangeOverhead += nextPareto(walpha, wxmin);                 // A3, B3
    var network_updateLatencies = [];
    for (var j = 0; j < S; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (S != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

function twoPhaseCommit(S, N, walpha, ralpha, pcalpha, psalpha, wxmin, rxmin,
  pcxmin, psxmin, iterations) {

  /*
   * Replication scheme: Two-Phase Commit with 1 Master and N - 1 Backups
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
  var Q = Math.floor(N / 2) + 1;

  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0
    var controllerOverhead = 0
    var exchangeOverhead = 0
    var colocation = (Math.floor(Math.random() * N) == 0);
    controllerOverhead += nextPareto(psalpha, psxmin);

    // Phase 1: N requests, Q responses
    var requestLatencies = [];
    var responseLatencies = [];
    for (var j = 1; j <= N - 1; j++) {
      requestLatencies.push(nextPareto(pcalpha, pcxmin));
      if (Q >= j) {
        responseLatencies.push(nextPareto(pcalpha, pcxmin));
      }
    }

    // Phase 2: N requests
    var requestLatencies2 = [];
    for (var j = 1; j <= N - 1; j++) {
      requestLatencies2.push(nextPareto(pcalpha, pcxmin));
    }

    if(!colocation) {
      exchangeOverhead += nextPareto(pcalpha, pcxmin);             // A1
      exchangeOverhead += Math.max.apply(null, requestLatencies);  // A2
      exchangeOverhead += Math.max.apply(null, responseLatencies); // A3
      exchangeOverhead += nextPareto(walpha, wxmin);               // A4
      exchangeOverhead += Math.max.apply(null, requestLatencies2);
    } else {
      exchangeOverhead += Math.max.apply(null, requestLatencies);  // B1
      exchangeOverhead += Math.max.apply(null, responseLatencies); // B2
    }
    exchangeOverhead += nextPareto(walpha, wxmin);                 // A5, B3
    var network_updateLatencies = [];
    for (var j = 0; j < S; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (S != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

function paxosCommit(S, N, walpha, ralpha, pcalpha, psalpha, wxmin, rxmin,
  pcxmin, psxmin, iterations) {

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
  var Q = Math.floor(N / 2)+1;

  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0
    var controllerOverhead = 0
    var exchangeOverhead = 0
    var colocation = (Math.floor(Math.random() * N) == 0);
    controllerOverhead += nextPareto(psalpha, psxmin);

    // Phase 1: N requests, Q responses
    var requestLatencies = [];
    var responseLatencies = [];
    for (var j = 1; j <= N - 1; j++) {
      requestLatencies.push(nextPareto(pcalpha, pcxmin));
      if (Q >= j) {
        responseLatencies.push(nextPareto(pcalpha, pcxmin));
      }
    }

    // Phase 2: N requests, Q responses
    var requestLatencies2 = [];
    var responseLatencies2 = [];
    for (var j = 1; j <= N - 1; j++) {
      requestLatencies2.push(nextPareto(pcalpha, pcxmin));
      if (Q >= j) {
        responseLatencies2.push(nextPareto(pcalpha, pcxmin));
      }
    }

    // Phase 3: N notifications
    var notificationLatencies = [];
    for (var j = 1; j <= N - 1; j++) {
      notificationLatencies.push(nextPareto(pcalpha, pcxmin));
    }

    if(!colocation) {
      exchangeOverhead += nextPareto(pcalpha, pcxmin);              // A1
      exchangeOverhead += Math.max.apply(null, requestLatencies);   // A2
      exchangeOverhead += Math.max.apply(null, responseLatencies);  // A3
      exchangeOverhead += Math.max.apply(null, requestLatencies2);  // A4
      exchangeOverhead += Math.max.apply(null, responseLatencies2); // A5
      exchangeOverhead += nextPareto(walpha, wxmin);                // A6
      exchangeOverhead += Math.max.apply(null, notificationLatencies);
    } else {
      exchangeOverhead += Math.max.apply(null, requestLatencies);   // B1
      exchangeOverhead += Math.max.apply(null, responseLatencies);  // B2
      exchangeOverhead += Math.max.apply(null, requestLatencies2);  // B3
      exchangeOverhead += Math.max.apply(null, responseLatencies2); // B4
    }
    exchangeOverhead += nextPareto(walpha, wxmin);                  // A7, B5
    var network_updateLatencies = [];
    for (var j = 0; j < S; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (S != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

