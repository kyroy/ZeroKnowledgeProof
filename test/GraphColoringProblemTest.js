/* global describe, it, beforeEach, before, after */
import { GraphColoringProblem, web3 } from '../contract/GraphColoringProblem.sol';
import { getRandomHexAdjacencyMatrix, binaryToHex, hexToBinary } from '../app/js/utils.js';
// import { Plan } from './utils.js';

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

let debugFilter, debugFilter2;

function initDebugFilters () {
  debugFilter = GraphColoringProblem.Debug({});
  debugFilter.watch((_, result) => {
    // event Debug(string message, bytes32 indexed taskId, address a, uint i, bytes32 b);
    console.log('Debug', result.args.message, result.args.taskId,
      result.args.a, result.args.i.toNumber(), result.args.b);
  });

  debugFilter2 = GraphColoringProblem.DebugMessage({});
  debugFilter2.watch((error, result) => {
    console.log('DebugMessage', error, result.args.message);
  });
}

function endDebugFilters () {
  debugFilter.stopWatching();
  debugFilter2.stopWatching();
}

var assert = require('chai').assert;

let account1 = web3.eth.accounts[0];
let account2 = web3.eth.accounts[1];

let taskId;

describe('GraphColoringProblem', function () {
  this.timeout(60000);
  this.slow(1500);
  before(initDebugFilters);
  after(endDebugFilters);

  let hexAdjacencyMatrix;
  let size = 4;

  describe('general', function () {
    beforeEach((done) => {
      let filter = GraphColoringProblem.TaskCreated({});
      filter.watch((_, result) => {
        taskId = result.args.taskId;
        assert.isOk(result.args.taskId);
        filter.stopWatching();
        done();
      });
      hexAdjacencyMatrix = getRandomHexAdjacencyMatrix(size, 0.5);
      GraphColoringProblem.createGraph(size, hexAdjacencyMatrix,
        { from: account1 });/*, value: web3.toWei(10, 'ether') */
    });

    describe('createGraph()', () => {
      it('should exist task and graph after before function', () => {
        let graph;
        assert.doesNotThrow(() => {
          graph = GraphColoringProblem.getGraph(taskId);
        });
        assert.equal(account1, GraphColoringProblem.getOwner(taskId));
        // assert.equal(web3.toWei(10, 'ether'), GraphColoringProblem.getReward(taskId).toNumber());
        assert.equal(size, graph[0].toNumber());
        assert.equal('string', typeof graph[1]);
      });

      it('should be possible to create another task', () => {
        assert.doesNotThrow(() => {
          GraphColoringProblem.createGraph(10, getRandomHexAdjacencyMatrix(10, 0.5),
            { from: account1 });
        });
      });

      it('should reject invalid adjacency matric', () => {
        assert.throw(() => {
          GraphColoringProblem.createGraph(4, '0x' + binaryToHex('0100100000010010').result,
            { from: account1 });
        });
      });
    });

    describe('getEdge()', () => {
      it('should return true for an existing edge', () => {
        let binAdjacencyMatrix = hexToBinary(hexAdjacencyMatrix).result;
        let edge = binAdjacencyMatrix.slice(1).indexOf('1') + 1;
        let v1 = parseInt(edge / size);
        let v2 = edge % size;
        assert.isTrue(GraphColoringProblem.getEdge(taskId, v1, v2));
      });

      it('should return false for a not existing edge', () => {
        let binAdjacencyMatrix = hexToBinary(hexAdjacencyMatrix).result;
        let edge = binAdjacencyMatrix.slice(1).indexOf('0') + 1;
        let v1 = parseInt(edge / size);
        let v2 = edge % size;
        assert.isFalse(GraphColoringProblem.getEdge(taskId, v1, v2));
      });
    });
  });

  describe('coherent tests', function () {
    before((done) => {
      let filter = GraphColoringProblem.TaskCreated({});
      filter.watch((_, result) => {
        taskId = result.args.taskId;
        assert.isOk(result.args.taskId);
        filter.stopWatching();
        done();
      });
      GraphColoringProblem.createGraph(4, '0x' + binaryToHex('1100100000010010').result,
        { from: account1 });/*, value: web3.toWei(10, 'ether') */
    });

    describe('workflow', () => {
      let colors = [ 0, 1, 0, 2 ];
      let nonces = [ 14, 342, 5234, 432 ];
      let requestedEdge = 1;

      it('should propose a solution', (done) => {
        let hashes = [
          solSha3(taskId, 0, colors[0], nonces[0]),
          solSha3(taskId, 1, colors[1], nonces[1]),
          solSha3(taskId, 2, colors[2], nonces[2]),
          solSha3(taskId, 3, colors[3], nonces[3])
        ];
        assert.doesNotThrow(() => {
          GraphColoringProblem.proposeSolution(taskId, hashes, { from: account2 });
        });
        let filter = GraphColoringProblem.SolutionProposed({});
        filter.watch((_, result) => {
          assert.equal(taskId, result.args.taskId);
          assert.equal(account2, result.args.proposer);
          assert.deepEqual(hashes, result.args.hashes);
          filter.stopWatching();
          done();
        });
      });
      it('should request an edge', (done) => {
        assert.doesNotThrow(() => {
          GraphColoringProblem.requestEdge(taskId, requestedEdge, { from: account1 });
        });
        let filter = GraphColoringProblem.SolutionRequestedEdge({});
        filter.watch((_, result) => {
          // event SolutionRequestedEdge(bytes32 indexed taskId, uint edge);
          assert.equal(taskId, result.args.taskId);
          assert.equal(requestedEdge, result.args.edge.toNumber());
          filter.stopWatching();
          done();
        });
      });
      it('should submit colors', (done) => {
        assert.doesNotThrow(() => {
          GraphColoringProblem.submitColors(taskId, colors[0], nonces[0], colors[1], nonces[1],
            { from: account2 });
        });
        let filter = GraphColoringProblem.SolutionSubmittedColors({});
        filter.watch((_, result) => {
          // event SolutionSubmittedColors(bytes32 indexed taskId, uint color1, uint nonce1,
          //                               uint color2, uint nonce2);
          assert.equal(taskId, result.args.taskId);
          assert.equal(colors[0], result.args.color1.toNumber());
          assert.equal(nonces[0], result.args.nonce1.toNumber());
          assert.equal(colors[1], result.args.color2.toNumber());
          assert.equal(nonces[1], result.args.nonce2.toNumber());
          filter.stopWatching();
          done();
        });
      });
      it('should accept a solution', (done) => {
        assert.doesNotThrow(() => {
          GraphColoringProblem.acceptSolution(taskId, { from: account1 });
        });
        let filter = GraphColoringProblem.SolutionAccepted({});
        filter.watch((_, result) => {
          // event SolutionAccepted(bytes32 indexed taskId, address proposer);
          assert.equal(taskId, result.args.taskId);
          assert.equal(account2, result.args.proposer);
          filter.stopWatching();
          done();
        });
      });
      it('should deliver the solution', (done) => {
        assert.doesNotThrow(() => {
          GraphColoringProblem.deliverSolution(taskId, colors, { from: account2 });
        });
        let filter = GraphColoringProblem.SolutionDelivered({});
        filter.watch((_, result) => {
          // event SolutionDelivered(bytes32 indexed taskId, uint[] colors);
          assert.equal(taskId, result.args.taskId);
          assert.deepEqual(colors, result.args.colors.map((x) => { return x.toNumber(); }));
          filter.stopWatching();
          done();
        });
      });
    });

    // let plan = new Plan(3, () => {
    //   done();
    // });
    //
    // let filter = Chess.GameEnded({});
    // filter.watch((error, result) => {
    //   assert.equal(gameId, result.args.gameId);
    //   assert.equal(player2, Chess.games(result.args.gameId)[5]);
    //   filter.stopWatching();
    //   done();
    // });
    //
    // // EloScoreUpdate event P2
    // let filter2 = Chess.EloScoreUpdate({player: player2});
    // filter2.watch((error, result) => {
    //   assert.equal(player2, result.args.player);
    //   assert.equal(121, result.args.score.toNumber());
    //   filter2.stopWatching();
    //   plan.ok();
    // });
  });

  describe('size tests', function () {
    function insertRandomGraph (size, density) {
      let edges = getRandomHexAdjacencyMatrix(size, density);
      GraphColoringProblem.createGraph(size, edges,
        { from: web3.eth.accounts[0] });
    }

    for (let i = 10; i < 230; i += 10) {
      it('should create a graph of size ' + i + ', density 0.4', (done) => { // jshint ignore:line
        assert.doesNotThrow(() => {
          insertRandomGraph(i, 0.4);
        });

        let filter = GraphColoringProblem.TaskCreated({});
        filter.watch((_, result) => {
          taskId = result.args.taskId;
          assert.isOk(result.args.taskId);
          filter.stopWatching();
          done();
        });
      });
    }
  });
});
