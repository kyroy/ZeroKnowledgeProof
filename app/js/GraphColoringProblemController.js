/* global angular, cytoscape */
import {web3, GraphColoringProblem} from '../../contract/GraphColoringProblem.sol';
angular.module('ZeroKnowledgeProof').controller('GraphColoringProblemController',
  function ($location, $routeParams) {
    this.insertStubData = function () {
      let num = parseInt(Math.random() * 9 + 4);
      let edges = [];
      for (let i = 0; i < num * num; i++) {
        edges.push(Math.random() < 0.5);
      }
      GraphColoringProblem.createGraph(num, edges,
        { from: web3.eth.accounts[0], value: web3.toWei(0, 'ether') });
    };

    this.insertStubData();

    this.setGraph = function (taskId) {
      let [numVertices, edges] = GraphColoringProblem.getGraph(taskId);
      numVertices = numVertices.toNumber();
      let elements = [];
      for (let i = 0; i < numVertices; i++) {
        elements.push({
          data: { id: i },
          selectable: false
        });
      }
      for (let i = 0; i < numVertices; i++) {
        for (let j = i; j < numVertices; j++) {
          if (edges[i * numVertices + j]) {
            elements.push({
              data: {
                id: i + '-' + j,
                source: i,
                target: j
              }
            });
          }
        }
      }
      let cy = cytoscape({
        container: document.getElementById('graph'),
        elements: elements,
        style: [{
          selector: 'node',
          style: {
            label: 'data(id)'
          }
        }]
      });
      cy.layout({ name: 'cose' });
      cy.on('tap', 'node', function (evt) {
        let node = evt.cyTarget;
        console.log('tapped node', node.id());
      });
      cy.on('tap', 'edge', function (evt) {
        let edge = evt.cyTarget;
        let [v1, v2] = edge.id().split('-');
        v1 = parseInt(v1);
        v2 = parseInt(v2);

        cy.$('node#' + v1).style({ 'background-color': 'green' });
        cy.$('node#' + v2).style({ 'background-color': 'green' });
      });
      $location.path({ id: taskId }, false);
    };

    this.unsolvedTasks = GraphColoringProblem.getUnsolvedTaskIds();

    if (typeof $routeParams.id !== 'undefined') {
      this.setGraph($routeParams.id);
    }
  }
);
