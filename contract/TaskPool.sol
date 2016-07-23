/*
 *
 * @author Dennis Kuhnert
 */
contract TaskPool {

    struct Task {
        address owner;
        uint reward;
        bool solved;
    }

    struct TaskList {
        bytes32 head;
        mapping (bytes32 => bytes32) list;
    }

    address public owner;
    mapping (address => uint) balances;
    mapping (bytes32 => Task) public tasks;
    TaskList public unsolvedTasks;
    mapping (address => TaskList) public tasksOfAccount;

    event Debug(string message, bytes32 indexed taskId, address a, uint i, bytes32 b);
    event DebugMessage(string message);
    event TaskCreated(bytes32 indexed taskId, address indexed owner, uint reward);

    modifier isContractOwner { if(msg.sender != owner) throw; _ }
    modifier isOwner (bytes32 taskId) { if (tasks[taskId].owner != msg.sender) throw; _ }
    modifier notSolved (bytes32 taskId) { if (tasks[taskId].solved) throw; _ }

    function TaskPool () {
        owner = msg.sender;
    }

    function createTask () public returns (bytes32) {
        bytes32 taskId = sha3(msg.sender, block.number);

        tasks[taskId].owner = msg.sender;
        tasks[taskId].reward = msg.value;
        tasks[taskId].solved = false;

        // add to unsolvedTasks
        unsolvedTasks.list[taskId] = unsolvedTasks.head;
        unsolvedTasks.head = taskId;

        // add task to tasksOfAccount
        tasksOfAccount[msg.sender].list[taskId] = tasksOfAccount[msg.sender].head;
        tasksOfAccount[msg.sender].head = taskId;

        TaskCreated(taskId, tasks[taskId].owner, tasks[taskId].reward);

        return taskId;
    }

    /* Needed when gas costs get too high -> new variables need to be added
    function openTask (bytes32 taskId) public {
        if (msg.sender != tasks[taskId].owner || tasks[taskId].open) {
            throw;
        }
        tasks[taskId].open = true;
    }

    function closeTask (bytes32 taskId) public {
        if (msg.sender != tasks[taskId].owner || !tasks[taskId].open) {
            throw;
        }
        tasks[taskId].open = false;
    }
    */

    function getUnsolvedTaskIds() constant returns (bytes32[]) {
        var counter = 0;
        for (var t = unsolvedTasks.head; t != 0; t = unsolvedTasks.list[t]) {
            counter++;
        }
        if (counter > 10) counter = 10; // TODO remove
        bytes32[] memory data = new bytes32[](counter);
        var currentTask = unsolvedTasks.head;
        for (var i = 0; i < counter; i++) {
            data[i] = currentTask;
            currentTask = unsolvedTasks.list[currentTask];
        }
        return data;
    }

    function getAccountTaskIds(address account) constant returns (bytes32[]) {
        var counter = 0;
        for (var t = tasksOfAccount[account].head; t != 0; t = tasksOfAccount[account].list[t]) {
            counter++;
        }
        if (counter > 10) counter = 10; // TODO remove
        bytes32[] memory data = new bytes32[](counter);
        var currentTask = tasksOfAccount[account].head;
        for (var i = 0; i < counter; i++) {
            data[i] = currentTask;
            currentTask = tasksOfAccount[account].list[currentTask];
        }
        return data;
    }

    function getOwner (bytes32 taskId) constant returns (address) {
        return tasks[taskId].owner;
    }

    function getReward (bytes32 taskId) constant returns (uint) {
        return tasks[taskId].reward;
    }

    function isSolved (bytes32 taskId) constant returns (bool) {
        return tasks[taskId].solved;
    }

    function balance() constant returns (uint) {
        return balances[msg.sender];
    }

    function withdraw () public {
        if(balances[msg.sender] <= 0) {
            throw;
        }
        uint payout = balances[msg.sender];
        balances[msg.sender] = 0;
        if (!msg.sender.send(payout)) {
            throw;
        }
    }

    /* This unnamed function is called whenever someone tries to send ether to the contract */
    function () {
        throw; // Prevents accidental sending of ether
    }
}
