/* global angular, cytoscape, jQuery */
import {web3, GraphColoringProblem} from '../../contract/GraphColoringProblem.sol';
import { getRandomHexAdjacencyMatrix } from './utils.js';

function leftPad (nr, n, str) {
  return Array(n - String(nr).length + 1).join(str || '0') + nr;
}

function solSha3 (...args) {
  args = args.map(arg => {
    if (typeof arg === 'string') {
      if (arg.substring(0, 2) === '0x') {
        return arg.slice(2);
      } else {
        return web3.toHex(arg).slice(2);
      }
    }

    if (typeof arg === 'number') {
      if (arg < 0) {
        return leftPad((arg >>> 0).toString(16), 64, 'F');
      }
      return leftPad((arg).toString(16), 64, 0);
    } else {
      return '';
    }
  });

  args = args.join('');

  return '0x' + web3.sha3(args, { encoding: 'hex' });
}

angular.module('ZeroKnowledgeProof').controller('GraphColoringProblemController',
  function (graphs, $route, $routeParams, $scope, $timeout) {
    this.currentTaskId = 0;
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

    this.proposeSolution = function () {
      if (typeof this.cytoscape === 'undefined') {
        console.error('proposeSolution: cytoscape undefined');
        return;
      }
      let vertices = this.cytoscape.collection('node').map(function (elem) {
        return elem.data();
      });
      let hashes = [];
      let colors = [];
      for (let vertex of vertices) {
        if (typeof vertex.color === 'undefined' || vertex.color < 0) {
          console.error('proposeSolution: color for node ' + vertex.id + ' not set');
          return;
        }
        let nonce = parseInt(Math.random() * 100);
        hashes.push(solSha3(this.currentTaskId, parseInt(vertex.id), vertex.color, nonce));
        colors.push({ nonce: nonce, color: vertex.color });
      }
      let graph = graphs.get(this.currentTaskId);
      graph.mySolution = colors;

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

      try {
        GraphColoringProblem.proposeSolution(this.currentTaskId, hashes,
          { from: web3.eth.accounts[0] });
      } catch (e) {
        console.error('proposeSolution: send to contract failed', e);
      }
    };

    this.setGraph = function (task) {
      this.currentTaskId = task.taskId;
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
        for (let j = i + 1; j < numVertices; j++) {
          if (edges[i * numVertices + j] === '1') {
            console.log('edge', i * numVertices + j);
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
            console.log('vertices', v1, v2);
            console.log('requestedEdge', requestedEdge);
            try {
              GraphColoringProblem.requestEdge(this.currentTaskId, requestedEdge,
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

    this.insertStubData = function () {
      let num = parseInt(Math.random() * 9 + 4);
      let edges = getRandomHexAdjacencyMatrix(num, 0.3);
      GraphColoringProblem.createGraph(num, edges,
        { from: web3.eth.accounts[0], value: web3.toWei(0.5, 'ether') });
    };

    // event SolutionSubmittedColors(bytes32 indexed taskId, uint color1, uint nonce1,
    //                               uint color2, uint nonce2);
    let eventSolutionSubmittedColors = GraphColoringProblem.SolutionSubmittedColors({});
    eventSolutionSubmittedColors.watch((_, result) => {
      console.log('eventSolutionSubmittedColors', result.args);
      if (result.args.taskId === this.currentTaskId && typeof this.cytoscape !== 'undefined') {
        let [v1, v2] = GraphColoringProblem.getRequestedVertices(this.currentTaskId);
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
