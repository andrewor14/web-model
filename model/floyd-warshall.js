/*
 * Directed link class
 */
function DirectedLink (src, dest) {
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
 * Construct link cost matrix from the given lists of d3 nodes and d3 links
 *
 * Finite link costs are only assigned to directly connected nodes. All other
 * elements of the matrix are assigned infinite cost.
 */
function link_matrix(d3_nodes, d3_links)
{
  var matrix = [];
  // Create matrix of size N^2, where N = number of nodes
  for (var i=0; i<d3_nodes.length; i++) {
    var row = []
    for (var j=0; j<d3_nodes.length; j++) {
      row.push([Number.POSITIVE_INFINITY, -1]);
    }
    row[i][0] = 0;
    row[i][1] = i;
    matrix.push(row);
  }
  // Connect the nodes
  for (var k=0; k<d3_links.length; k++) {
    var link = d3_links[k];
    var src = link.source.id-1;   // d3 nodes are not 0 indexed
    var dest = link.target.id-1;
    matrix[src][dest][0] = 100; // Arbitrary; change to actual distance
    matrix[src][dest][1] = src;
    matrix[dest][src][0] = 100; // Arbitrary; change to actual distance
    matrix[dest][src][1] = dest;
  }
  return matrix;
}

/*
 * Return a link matrix for the corresponding topology and run floyd-warshall
 */
function converged_link_matrix(d3_nodes, d3_links) {
  var matrix = link_matrix(d3_nodes, d3_links);
  floyd_warshall(matrix);
  return matrix;
}

/*
 * Return true if the given matrix represents a topology with no links
 */
function has_no_links(matrix){
  for (var i=0; i<matrix.length; i++) {
    for (var j=0; j<matrix[i].length; j++) {
      if ((matrix[i][j][0] != 0) &&
          (matrix[i][j][0] != Number.POSITIVE_INFINITY)) {
        return false;
      }
    }
  }
  return true;
}

/*
 * Return the list of switches to update given a change in network topology
 */
function switches_to_update(before_matrix, after_matrix)
{
  floyd_warshall(before_matrix);
  floyd_warshall(after_matrix);
  var before_dags = dags(before_matrix);
  var after_dags = dags(after_matrix);
  var switches_to_update = [];
  for (var x=0; x<before_dags.length; x++) {
    var before_dag = before_dags[x];
    var after_dag = after_dags[x];
    var exclusive_links = link_set_difference(before_dag, after_dag);
    // Collapse exclusive links into source switches
    for (var y=0; y<exclusive_links.length; y++) {
      var src = exclusive_links[y].src;
      if (switches_to_update.indexOf(src) == -1) {
        switches_to_update.push(src);
      }
    }
  }
  return switches_to_update;
}

/*
 * Return a list of links found in one of the given lists but not the other
 */
function link_set_difference(links1, links2)
{
  var difference = []
  // Find links found in links1 but not in links2
  for (var x=0; x<links1.length; x++) {
    var link1 = links1[x];
    var common = false;
    for (var y=0; y<links2.length; y++) {
      var link2 = links2[y];
      if (link1.equals(link2)) {
        common = true;
        break;
      }
    }
    if (!common) {
      difference.push(link1);
    }
  }
  // Find links found in links2 but not in links1
  for (var y=0; y<links2.length; y++) {
    var link2 = links2[y];
    var common = false;
    for (var x=0; x<links1.length; x++) {
      var link1 = links1[x];
      if (link2.equals(link1)) {
        common = true;
        break;
      }
    }
    if (!common) {
      difference.push(link2);
    }
  }
  return difference;
}

/*
 * Return the list of dags, each represented by a list of directed links, for
 *   each destination
 */
function dags(matrix)
{
  var dags = [];
  for (var i=0; i<matrix.length; i++) {
    // For each destination, find all links in the dag
    var dag_links = [];
    for (var j=0; j<matrix[i].length; j++) {
      // Find the set union of path links from all sources to the given dest
      var path_links = links_on_path(j, i, matrix);
      // Ensure no duplicates are added
      for (var k=0; k<path_links.length; k++) {
        var path_link = path_links[k];
        var duplicate = false;
        for (var l=0; l<dag_links.length; l++) {
          var dag_link = dag_links[l];
          if (path_link.equals(dag_link)) {
            duplicate = true;
            break;
          }
        }
        if (!duplicate) {
          dag_links.push(path_link);
        }
      }
    }
    dags.push(dag_links);
  }
  return dags;
}

/*
 * Return the list of directed links on the path from the given src to dest
 */
function links_on_path(src, dest, matrix)
{
  var links = [];
  var to = dest;
  var from = matrix[src][to][1];
  while (from != to) {
    link = new DirectedLink(from, to);
    links.splice(0, 0, link); // links.insert at index 0
    to = from;
    from = matrix[src][to][1];
  }
  return links;
}

/*
 * Floyd-Warshall algorithm: Compute all-pairs shortest distances,
 *   keeping track of the last hop node of each path
 *
 * Format: Link matrix with rows representing the sources and columns
 *   representing the destinations; each field in the link matrix is
 *   a [distance, last hop node] pair
 *
 * This method mutates matrix.
 */
function floyd_warshall(matrix)
{
  for (var i=0; i<matrix.length; i++) {
    var completedNodes = [i];
    while (completedNodes.length < matrix[i].length) {
      // Find the nearest incomplete node
      var nearestNode = -1;
      var nearestDistance = Number.POSITIVE_INFINITY;
      for (var j=0; j<matrix[i].length; j++) {
        if (completedNodes.indexOf(j) > -1) {     // completedNodes.contains(j)
          continue;
        }
        if (matrix[i][j][0] < nearestDistance){
          nearestNode = j;
          nearestDistance = matrix[i][j][0];
        }
      }
      if (nearestNode == -1) {
        break;
      }
      completedNodes.push(nearestNode);
      for (var k=0; k<matrix[i].length; k++) {
        if (completedNodes.indexOf(k) > -1) {
          continue;
        }
        // If new path through nearestNode is shorter, use that path instead
        var newDistance = matrix[i][nearestNode][0] + matrix[nearestNode][k][0];
        if (newDistance < matrix[i][k][0]) {
          matrix[i][k][0] = newDistance;
          if (nearestNode < i) {
            // If nearestNode's row is already done
            // Simply use nearestNode's most recent nodes
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
 * Link matrix pretty print: entries must be [distance, last hop node] pairs
 */
function print_link_matrix(matrix)
{
  for (var i=0; i<matrix.length; i++) {
    var s = "";
    for (var j=0; j<matrix.length; j++) {
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
 * Dags pretty print: entries must be list of DirectedLink objects
 */
function print_dags(dags)
{
  for (var i=0; i<dags.length; i++) {
    console.log("Dag(dest = "+i+"): "+dags[i]);
  }
}

/**********************************************************************
 **                                                                  **
 **                          EXAMPLE USAGE                           **
 **                                                                  **
 **********************************************************************/

/*
var inf = Number.POSITIVE_INFINITY;
var matrix1 = [[[0,0], [2,0], [8,0], [inf,-1], [inf,-1]],
    [[2,1], [0,1], [inf,-1], [13,1], [inf,-1]],
    [[8,2], [inf,-1], [0,2], [1,2], [inf,-1]],
    [[inf,-1], [13,3], [1,3], [0,3], [4,3]],
    [[inf,-1], [inf,-1], [inf,-1], [4,4], [0,4]]];
var matrix2 = [[[0,0], [2,0], [8,0], [inf,-1], [inf,-1]],
    [[2,1], [0,1], [inf,-1], [3,1], [inf,-1]],
    [[8,2], [inf,-1], [0,2], [1,2], [inf,-1]],
    [[inf,-1], [3,3], [1,3], [0,3], [4,3]],
    [[inf,-1], [inf,-1], [inf,-1], [4,4], [0,4]]];

console.log("***** matrix1 *****");
floyd_warshall(matrix1);
print_link_matrix(matrix1);
var dags1 = dags(matrix1);
print_dags(dags1);
console.log("\n\n");

console.log("***** matrix2 *****");
floyd_warshall(matrix2);
print_link_matrix(matrix2);
var dags2 = dags(matrix2);
print_dags(dags2);
console.log("\n\n");

console.log("***** Result *****");
console.log("Number of switches to update: "+num_switches_to_update(matrix1, matrix2));
*/

