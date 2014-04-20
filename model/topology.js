/* ------------------------------------------------ *
 * Classes that represent topologies and components *
 * ------------------------------------------------ */

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
 * Representation of a fat tree topology.
 */
function FatTreeTopology() {
  var links = [];
  this.numSwitches = 0;
  this.links = links;
}