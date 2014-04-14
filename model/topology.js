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
