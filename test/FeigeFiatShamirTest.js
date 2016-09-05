/* global describe, it, before */
import { FeigeFiatShamir, web3 } from '../contract/FeigeFiatShamir.sol';
import { toNumber } from '../app/js/utils.js';

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

  // TODO choose Blum prime integers
  let p = 139;
  let q = 347;
  // TODO pick a more secure n with all required properties
  let n = p * q;

  // select some coprimes
  let coprimes = coprimesBetween(parseInt(n / 2), n - 1, n);
  // secret vector s, with gcd(s_i, n) = 1
  let s = [];
  // (public) vector v where v_i and s_i^2 have the same remainder
  let v = [];
  for (let i = 0; i < 20; i++) {
    s.push(coprimes[parseInt(Math.random() * coprimes.length)]);
    v.push((s[i] * s[i]) % n);
  }

  // secret random number
  let r = parseInt(Math.random() * n);
  // public number
  let x = (r * r) % n;
  // TODO negative too
  // if (Math.random() < 0.5) {
  //   x = -x;
  // }

  describe('general', function () {
    before((done) => {
      let filter = FeigeFiatShamir.KeyRegistered({});
      filter.watch((_, result) => {
        keyId = result.args.keyId;
        assert.isOk(result.args.keyId);
        // console.log('KeyRegistered', result.args.n.toNumber(), result.args.v.map(toNumber));
        filter.stopWatching();
        done();
      });

      FeigeFiatShamir.register(n, v, { from: account1 });
    });

    let authId;
    let e;

    it('should approve an authentication step 1/2', (done) => {
      assert.doesNotThrow(() => {
        FeigeFiatShamir.startAuthentication(keyId, x, { from: account1 });
      });
      let filter = FeigeFiatShamir.AuthenticationStarted({});
      filter.watch((_, result) => {
        assert.isOk(result.args.authId);
        authId = result.args.authId;
        e = result.args.e.map(toNumber);
        // console.log('AuthenticationStarted', authId, result.args.x.toNumber(), e);
        filter.stopWatching();
        done();
      });
    });

    it('should approve an authentication step 2/2', (done) => {
      let y = r % n;
      for (let i = 0; i < s.length; i++) {
        y = (y * (Math.pow(s[i], e[i]) % n)) % n;
      }
      let expected = x % n;
      for (let i = 0; i < v.length; i++) {
        expected = (expected * (Math.pow(v[i], e[i]) % n)) % n;
      }
      assert.doesNotThrow(() => {
        FeigeFiatShamir.finishAuthentication(authId, y, { from: account1 });
      });
      let filter = FeigeFiatShamir.AuthenticationFinished({});
      filter.watch((_, result) => {
        assert.isOk(result.args.authId);
        // console.log('AuthenticationFinished', result.args.authId, result.args.y.toNumber());
        filter.stopWatching();
        done();
      });
    });
  });
});
