/* ================================================ *
 * Classes that represent topologies and components *
 * ================================================ */

/*
 * Representation of a directed link.
 */
function DirectedLink(src, dest) {
  this.src = src;
  this.dest = dest;
  this.toString = function() {
    return "("+this.src+"->"+this.dest+")";
  }
  this.equals = function(other) {
    return this.src == other.src && this.dest == other.dest;
  }
}

/*
 * Representation of a switch.
 */
function Switch(id) {
  this.id = id
}

/*
 * Representation of a mesh topology.
 */
function MeshTopology(numSwitches) {
  var links = [];
  for (var i = 0; i < numSwitches; i++) {
    for (var j = 0; j < numSwitches; j++) {
      if (i != j) {
        links.push(new DirectedLink(i, j))
      }
    }
  }
  this.numSwitches = numSwitches;
  this.links = links;
}

/*
 * Representation of a ring topology.
 */
function RingTopology(numSwitches) {
  var links = [];
  for (var i = 0; i < numSwitches; i++) {
    links.push(new DirectedLink(i, (i + 1) % numSwitches));
  }
  this.numSwitches = numSwitches;
  this.links = links;
}

/*
 * Representation of a star topology.
 */
function StarTopology(numSwitches) {
  var links = [];
  for (var i = 1; i < numSwitches; i++) {
    links.push(new DirectedLink(0, i));
    links.push(new DirectedLink(i, 0));
  }
  this.numSwitches = numSwitches;
  this.links = links;
}

/*
 * Representation of a fat-tree topology.
 *
 * This is based on the fat-tree described in the following publication:
 *
 * Al-Fares, Mohammad, Alexander Loukissas, and Amin Vahdat.
 * "A scalable, commodity data center network architecture."
 * ACM SIGCOMM Computer Communication Review. Vol. 38. No. 4. ACM, 2008.
 * (http://cseweb.ucsd.edu/~vahdat/papers/sigcomm08.pdf)
 */
function FatTreeTopology(numSwitches) {
  var links = [];
  var numPods = switchesToPods(numSwitches)

  /*
   * First, connect all switches within each pod (agg <-> edge). Each pod consists of a
   * sequential group of switch indices, with the first half allocated to aggregation switches,
   * and the second half to edge switches.
   *
   * For example, in a 4-pod network, the first pod consists of switches 0-3, where switches
   * 0 and 1 are aggregation switches, and switches 2 and 3 are edge switches. Then, the second
   * pod consists of switches 4-7, and so on.
   */
  var numSwitchesPerPod = numPods
  for (var p = 0; p < numPods; p++) {
    var podOffset = p * numSwitchesPerPod; // Switch index offset by pod
    for (var aggIndex = 0; aggIndex < numPods / 2; aggIndex++) {
      for (var edgeIndex = numPods / 2; edgeIndex < numPods; edgeIndex++) {
        var aggSwitchIndex = podOffset + aggIndex;
        var edgeSwitchIndex = podOffset + edgeIndex;
        links.push(new DirectedLink(aggSwitchIndex, edgeSwitchIndex));
        links.push(new DirectedLink(edgeSwitchIndex, aggSwitchIndex));
      }
    }
  }
  /*
   * Next, connect each pod to core switches (core <-> agg). For a k-pod fat-tree, there are
   * (k/2)^2 core switches. The i'th k/2 core switch is connected to the i'th aggregation switch
   * of each pod.
   *
   * For example, in a 4-pod network, there are 16 non-core switches and 4 core switches. Thus,
   * switches 16-19 are core switches. Core switches 16 and 17 are connected to the first aggregate
   * switch of each pod (i.e. 0, 4, 8, 12), and core switches 18 and 19 are connected to the second
   * (i.e. 1, 5, 9, 13).
   */
  var coreOffset = numSwitchesPerPod * numPods; // Index offset for core switches
  var numCoreSwitches = Math.pow(numPods / 2, 2);
  for (var c = 0; c < numCoreSwitches; c++) {
    var aggOffset = Math.floor(c / (numPods / 2));
    for (var p = 0; p < numPods; p++) {
      var podOffset = p * numSwitchesPerPod;
      var coreSwitchIndex = coreOffset + c;
      var aggSwitchIndex = podOffset + aggOffset;
      links.push(new DirectedLink(coreSwitchIndex, aggSwitchIndex));
      links.push(new DirectedLink(aggSwitchIndex, coreSwitchIndex));
    }
  }

  // Switches within pods + core switches
  this.numSwitches = numSwitchesPerPod * numPods + numCoreSwitches;
  this.links = links;
}

/*
 * Convert number of switches to approximate number of Fat-tree pods.
 *
 * For a k-pod fat-tree, there are k switches per pod. This adds up to k*k non-core switches.
 * Since there are (k/2)^2 core switches, the total number of switches adds up to k*k + (k/2)^2.
 * This is equal to 5/4 k^2, and the inverse is sqrt(4/5 * s).
 *
 * Return the closest number of pods rounded down to the nearest multiple of 2.
 */
function switchesToPods(numSwitches) {
  if (numSwitches < 5) {
    throw "Fat-tree topology is only supported for at least 5 switches (2 pods)!"
  }
  var numPods = Math.sqrt(4 / 5 * numSwitches)
  return Math.floor(numPods / 2) * 2
}

/*
 * Convert number of Fat-tree pods to number of switches.
 */
function podsToSwitches(numPods) {
  if (numPods < 2) {
    throw "Fat-tree topology is only supported for at least 2 pods!"
  }
  if (numPods % 2 == 1) {
    throw "Fat-tree topology is only supported for even number of pods!"
  }
  var numSwitchesPerPod = numPods
  var numCoreSwitches = Math.pow(numPods / 2, 2);
  return numSwitchesPerPod * numPods + numCoreSwitches;
}
