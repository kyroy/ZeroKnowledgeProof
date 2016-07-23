/* global angular, jQuery */
import {web3, GraphColoringProblem} from '../../contract/GraphColoringProblem.sol';
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
    return;
  };

  /**
   * Adds or updates a graph.
   */
  graphs.update = function (taskId, owner, reward, solved, numVertices, edges,
                            proposer, hashes = [], requestedEdge = 0, colors = []) {
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
      requestedEdge: requestedEdge,
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
    return graphs.update(taskId,
      GraphColoringProblem.getOwner(taskId),
      GraphColoringProblem.getReward(taskId).toNumber(),
      GraphColoringProblem.isSolved(taskId),
      graph[0].toNumber(), graph[1],
      GraphColoringProblem.getProposer(taskId),
      GraphColoringProblem.getHashedVertices(taskId),
      GraphColoringProblem.getRequestedEdge(taskId).toNumber(),
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
  let eventSolutionRequestedEdge = GraphColoringProblem.SolutionRequestedEdge({});
  eventSolutionRequestedEdge.watch((_, result) => {
    console.log('eventSolutionRequestedEdge', result.args);
    let graph = graphs.list.find(function (elem) {
      return result.args.taskId === elem.taskId;
    });
    if (typeof graph !== 'undefined' && typeof graph.mySolution !== 'undefined') {
      // use getter to get nodes in correct order
      let [v1, v2] = GraphColoringProblem.getRequestedVertices(result.args.taskId);
      try {
        GraphColoringProblem.submitColors(result.args.taskId,
          graph.mySolution[v1].color, graph.mySolution[v1].nonce,
          graph.mySolution[v2].color, graph.mySolution[v2].nonce,
          { from: graph.proposer });
      } catch (e) {
        console.error('graphsFactory: answer for requested edge failed', e);
      }
    }
  });
  // event SolutionSubmittedColors(bytes32 indexed taskId, uint color1, uint nonce1,
  //                               uint color2, uint nonce2);
  // let eventSolutionSubmittedColors = GraphColoringProblem.SolutionSubmittedColors({});
  // eventSolutionSubmittedColors.watch((_, result) => {
  //   console.log('eventSolutionSubmittedColors', result.args);
  //   if (result.args.taskId === this.currentTaskId) {
  //   }
  // });
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
