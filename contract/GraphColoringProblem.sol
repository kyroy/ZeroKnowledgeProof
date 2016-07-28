/*
 *
 * @author Dennis Kuhnert
 */

import "TaskPool.sol";

contract GraphColoringProblem is TaskPool {

    struct Vertex {
        uint id;
        bytes32 colorHash; // TODO may be removed
    }

    struct Graph {
        // ids of the nodes
        Vertex[] vertices;
        // adjacency matrix with the length of |vertices| * |vertices|
        bytes edges;
        Solution solution;
    }

    enum SolutionStatus { Open, Pending, Waiting, Accepted }

    struct Solution {
        address proposer;
        SolutionStatus status;
        bytes32[] colorHashes;
        uint requestedEdge;
        uint[] colors;
    }

    mapping (bytes32 => Graph) graphs;

    event SolutionProposed(bytes32 indexed taskId, address indexed proposer, bytes32[] hashes);
    event SolutionRequestedEdge(bytes32 indexed taskId, uint edge);
    event SolutionSubmittedColors(bytes32 indexed taskId, uint color1, uint nonce1, uint color2, uint nonce2);
    event SolutionAccepted(bytes32 indexed taskId, address proposer);
    event SolutionRejected(bytes32 indexed taskId, address proposer);
    event SolutionDelivered(bytes32 indexed taskId, uint[] colors);

    function createGraph (uint numVertices, bytes edges) public {
        bytes32 taskId = TaskPool.createTask();
        if (edges.length * 4 < numVertices * numVertices) {
            /*throw;*/
        }
        for (var i = 0; i < numVertices; i++) {
            graphs[taskId].vertices.push(Vertex(i, 0));
        }
        graphs[taskId].edges = edges;
    }

    function proposeSolution (bytes32 taskId, bytes32[] hashes) public notSolved(taskId) {
        var solution = graphs[taskId].solution;
        // another solution in progress
        if (solution.status != SolutionStatus.Open && solution.status != SolutionStatus.Waiting) {
            throw;
        }
        if (solution.proposer != 0 && solution.proposer != msg.sender) {
            throw;
        }

        solution.proposer = msg.sender;
        solution.status = SolutionStatus.Pending;
        solution.colorHashes = hashes;
        solution.requestedEdge = 0;
        SolutionProposed(taskId, solution.proposer, solution.colorHashes);
    }

    function requestEdge (bytes32 taskId, uint edge) public notSolved(taskId) isOwner(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.status != SolutionStatus.Pending || solution.requestedEdge != 0) {
            throw;
        }
        if (edge >= graphs[taskId].vertices.length * graphs[taskId].vertices.length) {
            throw;
        }
        // throw if edge is not present
        // TODO UMSTELLUNG
        /*if (!graphs[taskId].edges[edge]) {
            throw;
        }*/
        solution.requestedEdge = edge;
        SolutionRequestedEdge(taskId, solution.requestedEdge);
    }

    function submitColors (bytes32 taskId, uint color1, uint nonce1, uint color2, uint nonce2) public notSolved(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.proposer != msg.sender) {
            throw;
        }
        if (solution.status != SolutionStatus.Pending || solution.requestedEdge == 0) {
            throw;
        }
        if (color1 == color2) {
            throw;
        }
        var (v1, v2) = getRequestedVertices(taskId);
        if (sha3(taskId, v1, color1, nonce1) != solution.colorHashes[v1] ||
            sha3(taskId, v2, color2, nonce2) != solution.colorHashes[v2]) {
            throw;
        }
        solution.status = SolutionStatus.Waiting;
        SolutionSubmittedColors(taskId, color1, nonce1, color2, nonce2);
    }

    function acceptSolution (bytes32 taskId) notSolved(taskId) isOwner(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.status == SolutionStatus.Accepted) {
            throw;
        }
        solution.status = SolutionStatus.Accepted;
        SolutionAccepted(taskId, solution.proposer);
    }

    function rejectSolution (bytes32 taskId) notSolved(taskId) isOwner(taskId) {
        var solution = graphs[taskId].solution;
        SolutionRejected(taskId, solution.proposer);
        solution.proposer = 0;
        solution.status = SolutionStatus.Open;
    }

    function deliverSolution (bytes32 taskId, uint[] colors) notSolved(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.status != SolutionStatus.Accepted) {
            throw;
        }
        if (solution.proposer != msg.sender) {
            throw;
        }
        // TODO check colors length
        // test that the solution is correct may be too expensive
        solution.colors = colors;
        tasks[taskId].solved = true;
        uint reward = tasks[taskId].reward;
        tasks[taskId].reward = 0;
        balances[msg.sender] += reward;
        SolutionDelivered(taskId, solution.colors);
    }

    // ////////////
    // Getters
    // ////////////

    function getGraph (bytes32 taskId) constant returns (uint, bytes) {
        return (graphs[taskId].vertices.length, graphs[taskId].edges);
    }

    function getHashedVertices (bytes32 taskId) constant returns (bytes32[]) {
        return graphs[taskId].solution.colorHashes;
    }
    /*function getHashedVertices (bytes32 taskId) constant returns (bytes32[]) {
        Vertex[] vertices = graphs[taskId].vertices;
        bytes32[] memory hashes = new bytes32[](vertices.length);
        for (var i = 0; i < vertices.length; i++) {
            hashes[i] = vertices[i].colorHash;
        }
        return hashes;
    }*/

    function getProposer (bytes32 taskId) constant returns (address) {
        return graphs[taskId].solution.proposer;
    }

    function getRequestedEdge (bytes32 taskId) constant returns (uint) {
        return graphs[taskId].solution.requestedEdge;
    }

    function getRequestedVertices (bytes32 taskId) constant returns (uint, uint) {
        uint edge = graphs[taskId].solution.requestedEdge;
        if (edge == 0) {
            throw;
        }
        uint v2 = edge % graphs[taskId].vertices.length;
        uint v1 = (edge - v2) / graphs[taskId].vertices.length;
        return (v1, v2);
    }

    /*function getEdge (bytes32 taskId, uint v1, uint v2) constant returns (bool) {
        var length = graphs[taskId].vertices.length;
        return graphs[taskId].edges[v1 * length + v2];
    }*/

    function getSolution (bytes32 taskId) constant returns (uint[]) {
        return graphs[taskId].solution.colors;
    }
}
