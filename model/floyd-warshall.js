/* ===================================================== *
 * Helper methods for computing changes in routing state *
 * ===================================================== */

/*
 * Construct link cost matrix from the given lists of switches and links.
 *
 * Finite link costs are only assigned to directly connected nodes. All other elements of the
 * matrix are assigned infinite cost. Each entry of the matrix is a (distance, last hop node) pair.
 */
function linkMatrix(numSwitches, links) {
  var matrix = [];
  // Create an empty matrix of size n^2, where n = the number of switches
  for (var i = 0; i < numSwitches; i++) {
    var row = [];
    for (var j = 0; j < numSwitches; j++) {
      row.push([Number.POSITIVE_INFINITY, -1]);
    }
    row[i][0] = 0;
    row[i][1] = i;
    matrix.push(row);
  }
  // Connect the switches
  for (var k = 0; k < links.length; k++) {
    var link = links[k];
    var src = link.src;
    var dest = link.dest;
    matrix[src][dest][0] = 100; // Arbitrary; change to actual distance
    matrix[src][dest][1] = src;
  }
  return matrix;
}

/*
 * Return a link matrix for the corresponding topology and run the Floyd-Warshall algorithm.
 */
function convergedLinkMatrix(numSwitches, links) {
  var matrix = linkMatrix(numSwitches, links);
  floydWarshall(matrix);
  return matrix;
}

/*
 * Return true if the given matrix represents a topology with no links.
 */
function hasNoLinks(matrix) {
  for (var i = 0; i < matrix.length; i++) {
    for (var j = 0; j < matrix[i].length; j++) {
      if ((matrix[i][j][0] != 0) &&
          (matrix[i][j][0] != Number.POSITIVE_INFINITY)) {
        return false;
      }
    }
  }
  return true;
}

/*
 * Return the list of switches to update given a change in network topology.
 */
function switchesToUpdate(beforeMatrix, afterMatrix) {
  floydWarshall(beforeMatrix);
  floydWarshall(afterMatrix);
  var beforeDags = dags(beforeMatrix);
  var afterDags = dags(afterMatrix);
  var switchesToUpdate = [];
  for (var x = 0; x < beforeDags.length; x++) {
    var beforeDag = beforeDags[x];
    var afterDag = afterDags[x];
    var exclusiveLinks = linkSetDifference(beforeDag, afterDag);
    // Collapse exclusive links into source switches
    for (var y = 0; y < exclusiveLinks.length; y++) {
      var src = exclusiveLinks[y].src;
      if (switchesToUpdate.indexOf(src) == -1) {
        switchesToUpdate.push(src);
      }
    }
  }
  return switchesToUpdate;
}

/*
 * Return a list of links found in one of the given lists but not the other.
 */
function linkSetDifference(links1, links2) {
  var allLinks = links1.concat(links2);
  var difference = allLinks.filter(function(link) {
    var count = allLinks.filter(function(otherLink) {
      return link.equals(otherLink);
    }).length;
    // Keep only the unique links (by equality)
    return count == 1;
  });
  return difference;
}

/*
 * Return the list of dags, each represented by a list of directed links, one for each destination.
 */
function dags(matrix) {
  var dags = [];
  // For each destination, find all links in the dag
  for (var i = 0; i < matrix.length; i++) {
    var dagLinks = [];
    // Find the set union of path links from all sources to the given dest
    for (var j = 0; j < matrix[i].length; j++) {
      var pathLinks = linksOnPath(j, i, matrix);
      pathLinks.forEach(function(link) {
        var count = dagLinks.filter(function(otherLink) {
          return link.equals(otherLink);
        }).length;
        var alreadyExists = count > 0;
        if (!alreadyExists) { dagLinks.push(link); }
      });
    }
    dags.push(dagLinks);
  }
  return dags;
}

/*
 * Return the list of directed links on the path from the given src to the given dest.
 * This traces the back pointers recorded in the link matrix from the destination to the source.
 */
function linksOnPath(src, dest, matrix) {
  var links = [];
  var to = dest;
  var from = matrix[src][to][1];
  // from == to iff we have reached the src
  while (from != to && from != -1) {
    link = new DirectedLink(from, to);
    links.splice(0, 0, link); // links.insert(0)
    to = from;
    from = matrix[src][to][1];
  }
  return links;
}

/*
 * Run the Floyd-Warshall algorithm. Specifically, compute all-pairs shortest distances, keeping
 * track of the last hop node of each path. This method mutates the matrix.
 *
 * Format: Link matrix with rows representing the sources and columns representing the
 * destinations; each field in the link matrix is a (distance, last hop node) pair.
 */
function floydWarshall(matrix) {
  for (var i = 0; i < matrix.length; i++) {
    var completedNodes = [i];
    while (completedNodes.length < matrix[i].length) {
      // Find the nearest incomplete node
      var nearestNode = -1;
      var nearestDistance = Number.POSITIVE_INFINITY;
      for (var j = 0; j < matrix[i].length; j++) {
        if (completedNodes.indexOf(j) > -1) { continue; } // completedNodes.contains(j)
        if (matrix[i][j][0] < nearestDistance) {
          nearestNode = j;
          nearestDistance = matrix[i][j][0];
        }
      }
      if (nearestNode == -1) { break; }
      completedNodes.push(nearestNode);
      for (var k = 0; k < matrix[i].length; k++) {
        if (completedNodes.indexOf(k) > -1) { continue; }
        // If new path through nearestNode is shorter, use that path instead
        var newDistance = matrix[i][nearestNode][0] + matrix[nearestNode][k][0];
        if (newDistance < matrix[i][k][0]) {
          matrix[i][k][0] = newDistance;
          if (nearestNode < i) {
            // If nearestNode's row is already done, simply use nearestNode's most recent nodes
            matrix[i][k][1] = matrix[nearestNode][k][1];
          } else {
            // Otherwise, the nearestNode is the most recent node
            matrix[i][k][1] = nearestNode;
          }
        }
      }
    }
  }
}

/*
 * Link matrix pretty print: entries must be (distance, last hop node) pairs.
 */
function printLinkMatrix(matrix) {
  for (var i = 0; i < matrix.length; i++) {
    var s = "";
    for (var j = 0; j < matrix.length; j++) {
      if (matrix[i][j][0] == 0) {
        s += "0";
      } else if (matrix[i][j][0] == Number.POSITIVE_INFINITY ) {
        s += "inf";
      } else {
        s += matrix[i][j];
      }
      s += "\t";
    }
    console.log(s);
  }
}

/*
 * Dags pretty print: entries must be list of DirectedLink objects.
 */
function printDags(dags) {
  for (var i = 0; i < dags.length; i++) {
    console.log("Dag(dest = " + i + "): " + dags[i]);
  }
}

/* --------------- *
 *  Example usage  *
 * --------------- */

/*

var inf = Number.POSITIVE_INFINITY;
var matrix1 = [[[0,0],   [2,0],    [8,0],    [inf,-1], [inf,-1]],
              [[2,1],    [0,1],    [inf,-1], [13,1],   [inf,-1]],
              [[8,2],    [inf,-1], [0,2],    [1,2],    [inf,-1]],
              [[inf,-1], [13,3],   [1,3],    [0,3],    [4,3]],
              [[inf,-1], [inf,-1], [inf,-1], [4,4],    [0,4]]];
var matrix2 = [[[0,0],   [2,0],    [8,0],    [inf,-1], [inf,-1]],
              [[2,1],    [0,1],    [inf,-1], [3,1],    [inf,-1]],
              [[8,2],    [inf,-1], [0,2],    [1,2],    [inf,-1]],
              [[inf,-1], [3,3],    [1,3],    [0,3],    [4,3]],
              [[inf,-1], [inf,-1], [inf,-1], [4,4],    [0,4]]];

console.log("*** Matrix1 ***");
floydWarshall(matrix1);
printLinkMatrix(matrix1);
var dags1 = dags(matrix1);
printDags(dags1);
console.log("\n\n");

console.log("*** Matrix2 ***");
floydWarshall(matrix2);
printLinkMatrix(matrix2);
var dags2 = dags(matrix2);
printDags(dags2);
console.log("\n\n");

console.log("*** Result ***");
console.log("Number of switches to update: " + numSwitchesToUpdate(matrix1, matrix2));

*/
