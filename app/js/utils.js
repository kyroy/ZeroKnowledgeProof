import {web3} from '../../contract/GraphColoringProblem.sol';

function leftPad (nr, n, str) {
  return Array(n - String(nr).length + 1).join(str || '0') + nr;
}

export function solSha3 (...args) {
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

function calculateMerkeTree (taskId, colors, nonces) {
  let tree = [];
  let hashes = [];
  for (let i = 0; i < colors.length; i++) {
    hashes.push(solSha3(taskId, i, colors[i], nonces[i]));
  }
  tree.push(hashes);
  while (hashes.length > 1) {
    let oldHashes = hashes;
    hashes = [];
    for (let i = 0; i < oldHashes.length; i += 2) {
      let secondHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      if (i + 1 < oldHashes.length) {
        secondHash = oldHashes[i + 1];
      }
      hashes.push(solSha3(oldHashes[i], secondHash));
    }
    tree.push(hashes);
  }
  return tree;
}

export function calculateMerkleTrees (taskId, colors, nonces) {
  let trees = [];
  for (let n of nonces) {
    trees.push(calculateMerkeTree(taskId, colors, n));
  }
  return trees;
}

// converts binary string to a hexadecimal string
// returns an object with key 'valid' to a boolean value, indicating
// if the string is a valid binary string.
// If 'valid' is true, the converted hex string can be obtained by
// the 'result' key of the returned object
export function binaryToHex (s) {
  let i;
  let k;
  let accum;
  let ret = '';
  for (i = s.length - 1; i >= 3; i -= 4) {
    // extract out in substrings of 4 and convert to hex
    let part = s.substr(i + 1 - 4, 4);
    accum = 0;
    for (k = 0; k < 4; k += 1) {
      if (part[k] !== '0' && part[k] !== '1') {
        // invalid character
        return { valid: false };
      }
      // compute the length 4 substring
      accum = accum * 2 + parseInt(part[k], 10);
    }
    if (accum >= 10) {
      // 'A' to 'F'
      ret = String.fromCharCode(accum - 10 + 'A'.charCodeAt(0)) + ret;
    } else {
      // '0' to '9'
      ret = String(accum) + ret;
    }
  }
  // remaining characters, i = 0, 1, or 2
  if (i >= 0) {
    accum = 0;
    // convert from front
    for (k = 0; k <= i; k += 1) {
      if (s[k] !== '0' && s[k] !== '1') {
        return { valid: false };
      }
      accum = accum * 2 + parseInt(s[k], 10);
    }
    // 3 bits, value cannot exceed 2^3 - 1 = 7, just convert
    ret = String(accum) + ret;
  }
  return { valid: true, result: ret };
}

export function getRandomHexAdjacencyMatrix (numVertices, density) {
  let edgeArray = [];
  let edges = '';
  for (let i = 0; i < numVertices * numVertices; i++) {
    edgeArray.push(Math.random() < density && parseInt(i / numVertices) !== i % numVertices);
  }
  for (let i = 0; i < numVertices; i++) {
    for (let j = i + 1; j < numVertices; j++) {
      edgeArray[i * numVertices + j] = edgeArray[j * numVertices + i];
    }
  }
  for (let i = 0; i < numVertices * numVertices; i++) {
    edges += (edgeArray[i] ? '1' : '0');
  }
  while (edges.length % 8 !== 0) {
    edges += '0';
  }
  let e = binaryToHex(edges);
  if (e.valid) {
    return '0x' + e.result;
  } else {
    return undefined;
  }
}

// converts hexadecimal string to a binary string
// returns an object with key 'valid' to a boolean value, indicating
// if the string is a valid hexadecimal string.
// If 'valid' is true, the converted binary string can be obtained by
// the 'result' key of the returned object
export function hexToBinary (s) {
  let i = 0;
  let ret = '';
  // lookup table for easier conversion. '0' characters are padded for '1' to '7'
  var lookupTable = {
    '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
    '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
    'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
    'e': '1110', 'f': '1111',
    'A': '1010', 'B': '1011', 'C': '1100', 'D': '1101',
    'E': '1110', 'F': '1111'
  };
  if (s.startsWith('0x')) {
    i = 2;
  }
  for (; i < s.length; i += 1) {
    if (lookupTable.hasOwnProperty(s[i])) {
      ret += lookupTable[s[i]];
    } else {
      return { valid: false };
    }
  }
  return { valid: true, result: ret };
}

export function toNumber (x) {
  return x.toNumber();
}
