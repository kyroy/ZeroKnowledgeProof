/* global angular, cytoscape, jQuery */
import {web3, GraphColoringProblem} from '../../contract/GraphColoringProblem.sol';
import { getRandomHexAdjacencyMatrix, calculateMerkleTrees, toNumber, showWarning }
  from './utils.js';

angular.module('ZeroKnowledgeProof').controller('GraphColoringProblemController',
  function (graphs, $route, $routeParams, $scope, $timeout) {
    this.currentTaskId = 0;
    this.currentGraph = undefined;
    this.graphs = graphs;
    this.cytoscape = undefined;
    this.balance = 0;
    for (let account of web3.eth.accounts) {
      this.balance += GraphColoringProblem.balance({ from: account }).toNumber();
    }
    this.balance = web3.fromWei(this.balance, 'ether');
    const colorArray = [
      'green', 'red', 'blue'
    ];

    // NEW GRAPH
    this.newGraphVertices = undefined;
    this.newGraphDensity = undefined;
    this.newGraphSubmit = function () {
      this.newGraphVertices = parseInt(this.newGraphVertices);
      if (
        typeof this.newGraphVertices === 'undefined' ||
        typeof this.newGraphDensity === 'undefined' ||
        this.newGraphVertices <= 0 ||
        this.newGraphDensity < 0 ||
        this.newGraphDensity > 1
      ) {
        showWarning('Invalid input');
        return;
      }
      this.insertStubData(this.newGraphVertices, this.newGraphDensity);
    };
    // END NEW GRAPH

    this.proposeSolution = function () {
      // TODO randomize colors in different solutions
      if (typeof this.cytoscape === 'undefined') {
        console.error('proposeSolution: cytoscape undefined');
        return;
      }
      let vertices = this.cytoscape.collection('node').map(function (elem) {
        return elem.data();
      });
      // collect colors
      let colors = [];
      for (let vertex of vertices) {
        if (typeof vertex.color === 'undefined' || vertex.color < 0) {
          console.error('proposeSolution: color for node ' + vertex.id + ' not set');
          return;
        }
        colors.push(vertex.color);
      }

      // check solution
      let edges = this.cytoscape.collection('edge').map(function (elem) {
        return elem.data();
      });
      for (let edge of edges) {
        let [v1, v2] = edge.id.split('-');
        v1 = parseInt(v1);
        v2 = parseInt(v2);
        if (colors[v1] === colors[v2]) {
          console.error('proposeSolution: colors or vertex ' + v1 + ' and vertex ' +
                        v2 + ' are equal: ' + colors[v1]);
          return;
        }
      }

      // generate all nonces
      let nonces = [];
      for (let i = 0; i < 20; i++) {
        let ns = [];
        for (let j = 0; j < colors.length; j++) {
          ns.push(parseInt(Math.random() * 100));
        }
        nonces.push(ns);
      }

      let trees = calculateMerkleTrees(this.currentTaskId, colors, nonces);
      let graph = graphs.get(this.currentTaskId);
      graph.mySolution = colors;
      graph.myNonces = nonces;
      graph.myTreeHashes = trees;

      // get root hashes
      let hashes = [];
      for (let tree of trees) {
        hashes.push(tree[tree.length - 1][0]);
      }

      try {
        GraphColoringProblem.proposeSolution(this.currentTaskId, hashes,
          { from: web3.eth.accounts[0] });
      } catch (e) {
        console.error('proposeSolution: send to contract failed', e);
      }
    };

    this.setGraph = function (task) {
      this.currentTaskId = task.taskId;
      this.currentGraph = task;
      $route.updateParams({ id: this.currentTaskId });

      let [numVertices, edges] = [task.numVertices, task.edges];
      let elements = [];
      for (let i = 0; i < numVertices; i++) {
        elements.push({
          data: { id: i },
          selectable: false
        });
      }
      for (let i = 0; i < numVertices; i++) {
        for (let j = i; j < numVertices; j++) {
          if (edges[i * numVertices + j] === '1') {
            elements.push({
              data: {
                id: i + '-' + j,
                source: i,
                target: j
              },
              selectable: false
            });
          }
        }
      }
      jQuery(() => {
        this.cytoscape = cytoscape({
          container: document.getElementById('graph'),
          elements: elements,
          style: [{
            selector: 'node',
            style: {
              label: 'data(id)'
            }
          }]
        });
        this.cytoscape.layout({ name: 'cose' });
        this.cytoscape.on('tap', 'node', (evt) => {
          if (this.editSolution) {
            let node = evt.cyTarget;
            var color = node.data('color');
            if (typeof color === 'undefined') {
              node.data('color', 0);
            } else {
              node.data('color', (color + 1) % 3);
            }
            node.style({ 'background-color': colorArray[node.data('color')] });
          }
        });
        this.cytoscape.on('tap', 'edge', (evt) => {
          let edge = evt.cyTarget;
          let [v1, v2] = edge.id().split('-');
          v1 = parseInt(v1);
          v2 = parseInt(v2);
          let graph = graphs.get(this.currentTaskId);
          if (web3.eth.accounts.indexOf(graph.owner) !== -1) {
            let requestedEdge = v1 * graph.numVertices + v2;
            try {
              GraphColoringProblem.requestEdges(this.currentTaskId, [requestedEdge],
                { from: graph.owner });
              this.cytoscape.$('node#' + v1).style({ 'background-color': 'black' });
              this.cytoscape.$('node#' + v2).style({ 'background-color': 'black' });
            } catch (e) {
              console.error('requestEdge failed', e);
            }
          }
        });
      });
    };

    this.acceptSolution = function () {
      let graph = graphs.get(this.currentTaskId);
      if (typeof graph !== 'undefined') {
        try {
          GraphColoringProblem.acceptSolution(graph.taskId, { from: graph.owner });
        } catch (e) {
          console.error('acceptSolution failed', e);
        }
      }
    };

    this.rejectSolution = function () {
      let graph = graphs.get(this.currentTaskId);
      if (typeof graph !== 'undefined') {
        try {
          GraphColoringProblem.rejectSolution(graph.taskId, { from: graph.owner });
        } catch (e) {
          console.error('rejectSolution failed', e);
        }
      }
    };

    this.isOwner = function (taskId) {
      let graph = graphs.get(taskId);
      if (typeof graph !== 'undefined') {
        return web3.eth.accounts.indexOf(graph.owner) !== -1;
      }
      return false;
    };

    this.insertStubData = function (vertices, density = 0.3) {
      let num = vertices || parseInt(Math.random() * 9 + 4);
      let edges = getRandomHexAdjacencyMatrix(num, density);
      GraphColoringProblem.createGraph(num, edges,
        { from: web3.eth.accounts[0], value: web3.toWei(0.5, 'ether') });
    };

    // event SolutionSubmittedColors(bytes32 indexed taskId, uint color1, uint nonce1,
    //                               uint color2, uint nonce2);
    let eventSolutionSubmittedColors = GraphColoringProblem.SolutionSubmittedColors({});
    eventSolutionSubmittedColors.watch((_, result) => {
      console.log('eventSolutionSubmittedColors', result.args);
      if (result.args.taskId === this.currentTaskId && typeof this.cytoscape !== 'undefined') {
        let [v1, v2] = GraphColoringProblem.getRequestedVerticesOfSubmission(
          this.currentTaskId,
          result.args.submission.toNumber()
        ).map(toNumber);
        this.cytoscape.$('node#' + v1).style({
          'background-color': colorArray[result.args.color1.toNumber()]
        });
        this.cytoscape.$('node#' + v2).style({
          'background-color': colorArray[result.args.color2.toNumber()]
        });
      }
    });

    $scope.$on('$destroy', function () {
      eventSolutionSubmittedColors.stopWatching();
    });

    if (typeof $routeParams.id !== 'undefined') {
      this.currentTaskId = $routeParams.id;
      let graph = graphs.get(this.currentTaskId);
      if (typeof graph !== 'undefined') {
        $timeout(() => {
          this.setGraph(graph);
        }, 500);
      } else {
        console.error('Graph for ' + this.currentTaskId + ' not found!');
      }
    }
  }
);
