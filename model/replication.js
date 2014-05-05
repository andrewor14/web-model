// Copyright 2012-2013 Peter Bailis
// Copyright 2012-2013 Colin Scott
// Copyright 2012-2013 Andrew Or

/*
 * N: number of replicas
 * Q: number of replicas to wait from before committing
 *
 * {w, r, pc, ps}{alpha, xmin}: parameters that describe message delays. In this implementation,
 * they are Pareto distributed, but this need not be the case. See the paper or the site for more
 * description.
 */

/*
 * Compute samples that represent times to convergence using the traditional control plane.
 * More specifically, this uses traditional link-state route computation through flooding.
 *
 * Given a single failed link, the switches attached to the link floods this information to
 * all other switches in the network. Then, the time to convergence is computed by finding
 * the maximum of the distances from the origin switches to the furthest destination switches.
 *
 * TODO(cs): account for additional intermediate link failures
 *
 * Requires ./floyd-warshall.js
 */

function noController(srcToRemove, destToRemove, afterMatrix, switchesToUpdate,
  walpha, ralpha, pcalpha, psalpha, wxmin, rxmin, pcxmin, psxmin, iterations) {

  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    // Find the max number of hops to any other node
    var srcMaxHops = Number.NEGATIVE_INFINITY;
    var destMaxHops = Number.NEGATIVE_INFINITY;
    for (var j = 0; j < switchesToUpdate.length; j++){
      var srcHops = linksOnPath(srcToRemove, switchesToUpdate[j], afterMatrix).length;
      var destHops = linksOnPath(destToRemove, switchesToUpdate[j], afterMatrix).length;
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

/*
 * Compute samples that represent times to convergence using the single controller control plane.
 *
 * In this simple replication scheme, the controller computes a value, commits, and forwards
 * result to all client switches.
 *
 * Return samples in the form of (totalLatency, controllerOverhead, exchangeOverhead), where
 * controllerOverhead is the sheer overhead of having to go through a separate control plane,
 * and exchangeOverhead is the cost incurred by controllers communicating with each other.
 */
function singleController(numSwitches, numControllers,
  walpha, ralpha, pcalpha, psalpha, wxmin, rxmin, pcxmin, psxmin, iterations) {

  // For purposes of comparison with other replication schemes, ignore the number of controllers.

  var datapoints = [];
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0;
    var controllerOverhead = 0;
    var exchangeOverhead = 0;
    controllerOverhead += nextPareto(psalpha, psxmin);
    exchangeOverhead += nextPareto(walpha, wxmin);

    var network_updateLatencies = [];
    for (var j = 0; j < numSwitches; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (numSwitches != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

/*
 * Compute samples that represent times to convergence using a control plane distributed with
 * one-phase commit. This assumes 1 master and N-1 backups, where N is the number of controllers.
 *
 * In one-phase commit,
 *   (A1) Proposer (backup) forwards a request to master
 *   (A2) Master sends requests to all backups
 *   (A3) Proposer commits locally and forwards result to all client switches
 *        (Q Backups respond with ACKs, where Q is the quorum size)
 *
 * With co-location, this becomes
 *   (B1) Master sends requests to all backups
 *   (B2) Q backups commit locally and respond with ACKs
 *   (B3) Master commits locally and forwards result to all client switches
 */

function onePhaseCommit(numSwitches, numControllers,
  walpha, ralpha, pcalpha, psalpha, wxmin, rxmin, pcxmin, psxmin, iterations) {

  if (numControllers <= 1) {
    return [];
  }

  var datapoints = [];
  var quorumSize = Math.floor(numControllers / 2) + 1;
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0
    var controllerOverhead = 0
    var exchangeOverhead = 0
    var colocation = (Math.floor(Math.random() * numControllers) != 0);
    controllerOverhead += nextPareto(psalpha, psxmin);

    // Phase 1: N requests, Q responses
    var requestLatencies = [];
    var responseLatencies = [];
    for (var j = 1; j <= numControllers - 1; j++) {
      requestLatencies.push(nextPareto(pcalpha, pcxmin));
      if (quorumSize >= j) {
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
    for (var j = 0; j < numSwitches; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (numSwitches != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

/*
 * Compute samples that represent times to convergence using a control plane distributed with
 * two-phase commit. This assumes 1 master and N-1 backups, where N is the number of controllers.
 *
 * In two-phase commit,
 *   (A1) Proposer (backup) forwards a request to master
 *   (A2) Master sends Prepare requests to all backups
 *   (A3) Q backups respond with Prepare ACKs, where Q is the quorum size
 *   (A4) Master commits locally and sends Commit messages to all backups
 *   (A5) Proposer commits locally and forwards result to all client switches
 *
 * With co-location, this becomes,
 *   (B1) Master sends Prepare requests to all backups
 *   (B2) Q backups respond with Prepare ACKs
 *   (B3) Master commits locally and forwards result to all client switches
 *        (Master sends Commit messages to all backups)
 */
function twoPhaseCommit(numSwitches, numControllers,
  walpha, ralpha, pcalpha, psalpha, wxmin, rxmin, pcxmin, psxmin, iterations) {

  if (numControllers <= 1) {
    return [];
  }

  var datapoints = [];
  var quorumSize = Math.floor(numControllers / 2) + 1;
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0
    var controllerOverhead = 0
    var exchangeOverhead = 0
    var colocation = (Math.floor(Math.random() * numControllers) == 0);
    controllerOverhead += nextPareto(psalpha, psxmin);

    // Phase 1: N requests, Q responses
    var requestLatencies = [];
    var responseLatencies = [];
    for (var j = 1; j <= numControllers - 1; j++) {
      requestLatencies.push(nextPareto(pcalpha, pcxmin));
      if (quorumSize >= j) {
        responseLatencies.push(nextPareto(pcalpha, pcxmin));
      }
    }

    // Phase 2: N requests
    var requestLatencies2 = [];
    for (var j = 1; j <= numControllers - 1; j++) {
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
    for (var j = 0; j < numSwitches; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (numSwitches != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}

/*
 * Compute samples that represent times to convergence using a control plane distributed with Paxos.
 *
 * Assumptions:
 *   We do not consider optimizations that involve eliminating the Prepare phase.
 *   We consider leader-election a one-time cost and do not factor it in our computation.
 *
 * In Paxos,
 *   (A1) Proposer (replica) forwards a request to leader
 *   (A2) Leader sends Prepare requests to all replicas
 *   (A3) Q replicas respond with Prepare ACKs, where Q is the quorum size
 *   (A4) Leader sends Accept requests to all replicas
 *   (A5) Q replicas respond with Accept ACKs
 *   (A6) Leader selects a value, commits locally, and notifies all replicas of the selected value
 *   (A7) Proposer commits locally and forwards result to all client switches
 *
 * With co-location, this becomes,
 *   (B1) Leader sends Prepare requests to all replicas
 *   (B2) Q Backups respond with Prepare ACKs
 *   (B3) Leader sends Accept requests to all replicas
 *   (B4) Q Backups respond with Accept ACKs
 *   (B5) Leader selects a value, commits locally, and forwards result to all client switches
 *        (Leader notifies all replicas of the selected value)
 */
function paxosCommit(numSwitches, numControllers,
  walpha, ralpha, pcalpha, psalpha, wxmin, rxmin, pcxmin, psxmin, iterations) {

  if (numControllers <= 1) {
    return [];
  }

  var datapoints = [];
  var quorumSize = Math.floor(numControllers / 2) + 1;
  for (var i = 0; i < iterations; i++) {
    var totalLatency = 0
    var controllerOverhead = 0
    var exchangeOverhead = 0
    var colocation = (Math.floor(Math.random() * numControllers) == 0);
    controllerOverhead += nextPareto(psalpha, psxmin);

    // Phase 1: N requests, Q responses
    var requestLatencies = [];
    var responseLatencies = [];
    for (var j = 1; j <= numControllers - 1; j++) {
      requestLatencies.push(nextPareto(pcalpha, pcxmin));
      if (quorumSize >= j) {
        responseLatencies.push(nextPareto(pcalpha, pcxmin));
      }
    }

    // Phase 2: N requests, Q responses
    var requestLatencies2 = [];
    var responseLatencies2 = [];
    for (var j = 1; j <= numControllers - 1; j++) {
      requestLatencies2.push(nextPareto(pcalpha, pcxmin));
      if (quorumSize >= j) {
        responseLatencies2.push(nextPareto(pcalpha, pcxmin));
      }
    }

    // Phase 3: N notifications
    var notificationLatencies = [];
    for (var j = 1; j <= numControllers - 1; j++) {
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
    for (var j = 0; j < numSwitches; j++) {
      network_updateLatencies.push(nextPareto(psalpha, psxmin));
    }
    if (numSwitches != 0) {
      controllerOverhead += Math.max.apply(null, network_updateLatencies);
    }
    totalLatency += controllerOverhead
    totalLatency += exchangeOverhead
    datapoints.push([totalLatency, controllerOverhead, exchangeOverhead])
  }
  return datapoints;
}
