import "TaskPool.sol";

/**
 * @title Graph Coloring Problem
 * @author Dennis Kuhnert (kyroy)
 *
 * <short description>
 *
 * <detailed description>
 *
 */
contract GraphColoringProblem is TaskPool {

    struct Graph {
        uint vertices; ///< number of vertices
        bytes edges; ///< adjacency matrix with the length of |vertices| * |vertices|
                     ///< where the first bit is always set to ensure the correct length
        Solution solution;
    }

    enum SolutionStatus { Open, Pending, Accepted }

    struct Solution {
        address proposer;
        SolutionStatus status;
        bytes32[] treeHashes; ///< array of merke tree hashes
        uint[] requestedEdges;
        uint submissions;
        uint[] colors;
    }

    mapping (bytes32 => Graph) graphs;

    event SolutionProposed(bytes32 indexed taskId, address indexed proposer, bytes32[] hashes);
    event SolutionRequestedEdges(bytes32 indexed taskId, uint submissions, uint[] edges);
    event SolutionSubmittedColors(bytes32 indexed taskId, uint submission, uint color1, uint nonce1, uint color2, uint nonce2);
    event SolutionAccepted(bytes32 indexed taskId, address proposer);
    event SolutionRejected(bytes32 indexed taskId, address proposer);
    event SolutionDelivered(bytes32 indexed taskId, uint[] colors);

    /**
     * @notice <user description>
     *
     * @dev <developer description>
     *
     * @param vertices The number of vertices of the graph.
     * @param edges A hex number where each bit represents the existence of an edge.
                    Right padded with zeroes.
     *              TODO structure (adj matrix)
     * @return The identifier of the task, also used to identify the graph.
     */
    function createGraph (uint vertices, bytes edges) public {
        bytes32 taskId = TaskPool.createTask();
        // check length of edges
        if (edges.length * 8 < vertices * vertices) {
            throw;
        }
        graphs[taskId].vertices = vertices;
        graphs[taskId].edges = edges;
    }

    function proposeSolution (bytes32 taskId, bytes32[] hashes) public notSolved(taskId) {
        var solution = graphs[taskId].solution;
        // another solution in progress
        if (solution.proposer != 0) {
            throw;
        }

        solution.proposer = msg.sender;
        solution.status = SolutionStatus.Open;
        solution.treeHashes = hashes;
        solution.requestedEdges = new uint[](0);
        solution.submissions = 0;
        SolutionProposed(taskId, solution.proposer, solution.treeHashes);
    }

    function requestEdges (bytes32 taskId, uint[] edges) public notSolved(taskId) isOwner(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.proposer == 0) {
            throw;
        }
        if (solution.requestedEdges.length + edges.length > solution.treeHashes.length) {
            throw;
        }
        // TODO throw if edge is not present?
        solution.status = SolutionStatus.Pending;
        for (var i = 0; i < edges.length; i++) {
            solution.requestedEdges.push(edges[i]);
        }
        SolutionRequestedEdges(taskId, solution.submissions, solution.requestedEdges);
    }

    /**
     * merkeHashes TODO
     */
    function submitColors (bytes32 taskId, uint color1, uint nonce1, uint color2, uint nonce2,
                           bytes32[] merkleHashes1, bytes32[] merkleHashes2) public notSolved(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.proposer != msg.sender) {
            throw;
        }
        if (solution.status != SolutionStatus.Pending || solution.submissions == solution.requestedEdges.length) {
            throw;
        }
        if (color1 == color2) {
            throw;
        }
        var (v1, v2) = getRequestedVertices(taskId);
        uint i = 0;
        /* example 'position' of merkle tree
        0 1  2 3  4 5  6 7  8 9
         0    1    2    3    4
           0         1       2
                0            1
        */
        // verify merkleHashes1
        if (2**merkleHashes1.length < graphs[taskId].vertices) {
            throw;
        }
        uint position = v1;
        bytes32 hash = sha3(taskId, v1, color1, nonce1);
        for (i = 0; i < merkleHashes1.length; i++) {
            if (position % 2 == 0) {
                hash = sha3(hash, merkleHashes1[i]);
            } else {
                hash = sha3(merkleHashes1[i], hash);
            }
            position = position / 2;
        }
        if (solution.treeHashes[solution.submissions] != hash) {
            throw;
        }

        // verify merkleHashes2
        if (2**merkleHashes2.length < graphs[taskId].vertices) {
            throw;
        }
        position = v2;
        hash = sha3(taskId, v2, color2, nonce2);
        for (i = 0; i < merkleHashes2.length; i++) {
            if (position % 2 == 0) {
                hash = sha3(hash, merkleHashes2[i]);
            } else {
                hash = sha3(merkleHashes2[i], hash);
            }
            position = position / 2;
        }
        if (solution.treeHashes[solution.submissions] != hash) {
            throw;
        }
        SolutionSubmittedColors(taskId, solution.submissions, color1, nonce1, color2, nonce2);
        solution.submissions++;
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
        solution.proposer = 0;
        solution.status = SolutionStatus.Open;
        SolutionRejected(taskId, solution.proposer);
    }

    function deliverSolution (bytes32 taskId, uint[] colors) notSolved(taskId) {
        var solution = graphs[taskId].solution;
        if (solution.status != SolutionStatus.Accepted) {
            throw;
        }
        if (solution.proposer != msg.sender) {
            throw;
        }
        if (colors.length != graphs[taskId].vertices) {
            throw;
        }
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
        return (graphs[taskId].vertices, graphs[taskId].edges);
    }

    function getTreeHashes (bytes32 taskId) constant returns (bytes32[]) {
        return graphs[taskId].solution.treeHashes;
    }

    function getProposer (bytes32 taskId) constant returns (address) {
        return graphs[taskId].solution.proposer;
    }

    function getRequestedEdges (bytes32 taskId) constant returns (uint[]) {
        return graphs[taskId].solution.requestedEdges;
    }

    function getRequestedVerticesOfSubmission (bytes32 taskId, uint submission) constant returns (uint, uint) {
        uint edge = graphs[taskId].solution.requestedEdges[submission];
        if (edge == 0) {
            throw;
        }
        uint v2 = edge % graphs[taskId].vertices;
        uint v1 = (edge - v2) / graphs[taskId].vertices;
        return (v1, v2);
    }

    function getRequestedVertices (bytes32 taskId) constant returns (uint, uint) {
        uint position = graphs[taskId].solution.submissions;
        return getRequestedVerticesOfSubmission(taskId, position);
    }

    function getSubmissionCount (bytes32 taskId) constant returns (uint) {
        return graphs[taskId].solution.submissions;
    }

    function getEdge (bytes32 taskId, uint v1, uint v2) constant returns (bool) {
        uint edge = v1 * graphs[taskId].vertices + v2;
        if (edge >= graphs[taskId].vertices * graphs[taskId].vertices) {
            throw;
        }
        uint edgeIndex = edge / 8;
        uint edgeOffset = 7 - edge % 8;
        uint filter = 2**edgeOffset;
        return uint(graphs[taskId].edges[edgeIndex]) & filter == filter;
    }

    function getSolution (bytes32 taskId) constant returns (uint[]) {
        return graphs[taskId].solution.colors;
    }
}
