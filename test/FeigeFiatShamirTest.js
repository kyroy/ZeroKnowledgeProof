/* global describe, it, before */
import { FeigeFiatShamir, web3 } from '../contract/FeigeFiatShamir.sol';
// import { Plan } from './utils.js';
/*
let debugFilter, debugFilter2;

function initDebugFilters () {
  debugFilter = GraphColoringProblem.Debug({});
  debugFilter.watch((_, result) => {
    // event Debug(string message, bytes32 indexed keyId, address a, uint i, bytes32 b);
    console.log('Debug', result.args.message, result.args.keyId,
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
*/
var assert = require('chai').assert;
var coprimesBetween = require('coprimes-between');

let account1 = web3.eth.accounts[0];
// let account2 = web3.eth.accounts[1];

let keyId;

describe('FeigeFiatShamir', function () {
  this.timeout(60000);
  this.slow(1000);
  // before(initDebugFilters);
  // after(endDebugFilters);

  // let p = 100000000091;
  // let q = 100000000069;
  let p = 3539;
  let q = 6343;
  let n = p * q;
  console.log('n', n);
  // select some coprimes
  let coprimes = coprimesBetween(parseInt(n / 2), n - 1, n);
  let s = [];
  let v = [];
  for (let i = 0; i < 20; i++) {
    s.push(coprimes[parseInt(Math.random() * coprimes.length)]);
    v.push((s[i] * s[i]) % n);
  }
  console.log('s', s, '(coprimes)');
  console.log('v', v);
  let r = [];
  let x = [];
  for (let i = 0 ; i < s.length; i++) {
    r.push(parseInt(Math.random() * v[i]));
    x.push((s[i] * r[i] * r[i]) % n);
  }
  console.log('r', r);
  console.log('x', x);

  describe('general', function () {
    before((done) => {
      let filter = FeigeFiatShamir.KeyRegistered({});
      filter.watch((_, result) => {
        keyId = result.args.keyId;
        assert.isOk(result.args.keyId);
        console.log('KeyRegistered', result.args.n.toNumber(), result.args.v.toNumber());
        filter.stopWatching();
        done();
      });

      FeigeFiatShamir.register(n, v[0], { from: account1 });
    });

    let authId;
    let e;

    it('should approve an authentication step 1/2', (done) => {
      assert.doesNotThrow(() => {
        FeigeFiatShamir.startAuthentication(keyId, x[0], { from: account1 });
      });
      let filter = FeigeFiatShamir.AuthenticationStarted({});
      filter.watch((_, result) => {
        assert.isOk(result.args.authId);
        authId = result.args.authId;
        e = result.args.e.map((x) => { return x.toNumber(); });
        console.log('AuthenticationStarted', authId, result.args.x.toNumber(), e);
        filter.stopWatching();
        done();
      });
    });

    it('should approve an authentication step 2/2', (done) => {
      let y = r * Math.pow(s[0], e[0]);
      console.log('y', y);
      console.log('((y * y) % key.v', (y * y) % v);
      console.log('(auth.x * key.v**auth.e[0]) % key.v', (x[0] * Math.pow(v[0], e[0])) % v);
      assert.doesNotThrow(() => {
        FeigeFiatShamir.finishAuthentication(authId, y, { from: account1 });
      });
      let filter = FeigeFiatShamir.AuthenticationFinished({});
      filter.watch((_, result) => {
        assert.isOk(result.args.authId);
        authId = result.args.authId;
        console.log('AuthenticationFinished', authId, result.args.y.toNumber());
        filter.stopWatching();
        done();
      });
    });
  });
});
