/* global angular, jQuery */
import {web3, GraphColoringProblem} from '../../contract/GraphColoringProblem.sol';
import { hexToBinary, toNumber } from './utils.js';
angular.module('ZeroKnowledgeProof').factory('graphs', function ($rootScope) {
  let graphs = {
    taskIds: [],
    list: []
  };

  graphs.get = function (taskId) {
    if (graphs.taskIds.indexOf(taskId) !== -1) {
      let graph = graphs.list.find(function (elem) {
        return taskId === elem.taskId;
      });
      if (typeof graph === 'undefined') {
        return graphs.loadGraphById(taskId);
      } else {
        return graph;
      }
    }
  };

  /**
   * Adds or updates a graph.
   */
  graphs.update = function (taskId, owner, reward, solved, numVertices, edges,
                            proposer, hashes = [], requestedEdges = [], colors = []) {
    let graph = graphs.list.find(function (elem) {
      return taskId === elem.taskId;
    });
    let newGraph = {
      taskId: taskId,
      owner: owner,
      reward: reward,
      solved: solved,
      numVertices: numVertices,
      edges: edges,
      proposer: proposer,
      hashes: [],
      requestedEdges: requestedEdges,
      colors: colors
      // mySolution // stored solution for the problem of this client
    };
    if (typeof graph === 'undefined') {
      graphs.list.push(newGraph);
      return newGraph;
    } else {
      jQuery.extend(graph, newGraph);
      return graph;
    }
  };

  graphs.loadGraphById = function (taskId) {
    console.log('loadGraphById', taskId);
    let graph = GraphColoringProblem.getGraph(taskId);
    let edges = hexToBinary(graph[1].slice(2)).result;
    return graphs.update(taskId,
      GraphColoringProblem.getOwner(taskId),
      GraphColoringProblem.getReward(taskId).toNumber(),
      GraphColoringProblem.isSolved(taskId),
      graph[0].toNumber(),
      edges,
      GraphColoringProblem.getProposer(taskId),
      GraphColoringProblem.getTreeHashes(taskId),
      GraphColoringProblem.getRequestedEdges(taskId).map(toNumber),
      GraphColoringProblem.getSolution(taskId)
    );
  };

  graphs.taskIds = GraphColoringProblem.getUnsolvedTaskIds();
  for (let account of web3.eth.accounts) {
    for (let taskId of GraphColoringProblem.getAccountTaskIds(account)) {
      if (graphs.taskIds.indexOf(taskId) === -1) {
        graphs.taskIds.push(taskId);
      }
    }
  }

  // ////////////
  // Events
  // ////////////

  let eventTaskCreated = GraphColoringProblem.TaskCreated({});
  eventTaskCreated.watch((_, result) => {
    console.log('eventTaskCreated', result.args);
    if (graphs.taskIds.indexOf(result.args.taskId) === -1) {
      graphs.taskIds.push(result.args.taskId);
      $rootScope.$apply();
    }
  });

  // event SolutionProposed(bytes32 indexed taskId, address indexed proposer, bytes32[] hashes);
  let eventSolutionProposed = GraphColoringProblem.SolutionProposed({});
  eventSolutionProposed.watch((_, result) => {
    console.log('eventSolutionProposed', result.args);
    let graph = graphs.list.find(function (elem) {
      return result.args.taskId === elem.taskId;
    });
    if (typeof graph !== 'undefined') {
      graph.proposer = result.args.proposer;
      graph.hashes = result.args.hashes;
    }
  });
  // event SolutionRequestedEdge(bytes32 indexed taskId, uint edge);
  let eventSolutionRequestedEdges = GraphColoringProblem.SolutionRequestedEdges({});
  eventSolutionRequestedEdges.watch((_, result) => {
    console.log('eventSolutionRequestedEdge', result.args);
    let graph = graphs.list.find(function (elem) {
      return result.args.taskId === elem.taskId;
    });
    if (typeof graph !== 'undefined' && typeof graph.mySolution !== 'undefined') {
      // send all missing submissions
      for (let i = result.args.submissions.toNumber(); i < result.args.edges.length; i++) {
        // use getter to get nodes in correct order
        let vertices = GraphColoringProblem.getRequestedVertices(result.args.taskId).map(toNumber);
        let [v1, v2] = vertices;
        let merkleHashes = [[], []];
        for (let j = 0; j < 2; j++) {
          // select the counterpart of each level in the merkle tree
          // without the root hash
          for (let k = 0; k < graph.myTreeHashes[i].length - 1; k++) {
            if (vertices[j] % 2 === 0) {
              if (vertices[j] + 1 < graph.myTreeHashes[i][k].length) {
                merkleHashes[j].push(graph.myTreeHashes[i][k][vertices[j] + 1]);
              } else {
                // if there is no counterpart, we use 0x00
                merkleHashes[j].push(
                  '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
              }
            } else {
              merkleHashes[j].push(graph.myTreeHashes[i][k][vertices[j] - 1]);
            }
            vertices[j] = parseInt(vertices[j] / 2);
          }
        }
        try {
          GraphColoringProblem.submitColors(result.args.taskId,
            graph.mySolution[v1], graph.myNonces[i][v1],
            graph.mySolution[v2], graph.myNonces[i][v2],
            merkleHashes[0], merkleHashes[1],
            { from: graph.proposer });
        } catch (e) {
          console.error('graphsFactory: answer for requested edge failed', e);
        }
      }
    }
  });
  // event SolutionAccepted(bytes32 indexed taskId, address proposer);
  let eventSolutionAccepted = GraphColoringProblem.SolutionAccepted({});
  eventSolutionAccepted.watch((_, result) => {
    console.log('eventSolutionAccepted', result.args);
    let graph = graphs.list.find(function (elem) {
      return result.args.taskId === elem.taskId;
    });
    if (typeof graph !== 'undefined' && typeof graph.mySolution !== 'undefined') {
      let colors = [];
      for (let cPair of graph.mySolution) {
        colors.push(cPair.color);
      }
      try {
        GraphColoringProblem.deliverSolution(result.args.taskId, colors,
          { from: graph.proposer });
      } catch (e) {
        console.error('graphsFactory: delivering result failed', e);
      }
    }
  });
  // event SolutionRejected(bytes32 indexed taskId, address proposer);
  let eventSolutionRejected = GraphColoringProblem.SolutionRejected({});
  eventSolutionRejected.watch((_, result) => {
    console.log('eventSolutionRejected', result.args);
  });
  // event SolutionDelivered(bytes32 indexed taskId, uint[] colors);
  let eventSolutionDelivered = GraphColoringProblem.SolutionDelivered({});
  eventSolutionDelivered.watch((_, result) => {
    console.log('eventSolutionDelivered', result.args);
    if (web3.eth.accounts.indexOf(GraphColoringProblem.getOwner(result.args.taskId)) !== -1) {
      // TODO update balance in header
    }
  });

  let debugFilter = GraphColoringProblem.Debug({});
  debugFilter.watch((_, result) => {
    // event Debug(string message, bytes32 indexed taskId, address a, uint i, bytes32 b);
    console.log('Debug', result.args.message, result.args.taskId,
      result.args.a, result.args.i.toNumber(), result.args.b);
  });

  // $scope.$on('$destroy', function () {
  //   console.log('destroy $scope');
  //   eventTaskCreated.stopWatching();
  //   eventSolutionProposed.stopWatching();
  //   eventSolutionRequestedEdge.stopWatching();
  //   eventSolutionSubmittedColors.stopWatching();
  //   eventSolutionAccepted.stopWatching();
  //   eventSolutionRejected.stopWatching();
  //   eventSolutionDelivered.stopWatching();
  // });

  return graphs;
});
