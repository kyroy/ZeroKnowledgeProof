/**
 * Implementation of the Feige-Fiat-Shamir identification scheme.
 * Not secure in a public blockchain because all information of the verifier
 * are public.
 *
 * @author Dennis Kuhnert
 */
contract FeigeFiatShamir {
    //
    struct Key {
        uint n;
        uint v;
    }

    struct Authentication {
        bytes32 keyId;
        uint x;
        uint8[] e;
    }

    mapping (bytes32 => Key) keys;
    mapping (bytes32 => Authentication) authentications;

    event KeyRegistered(bytes32 indexed keyId, uint n, uint v);
    event AuthenticationStarted(bytes32 indexed authId, uint x, uint8[] e);
    event AuthenticationFinished(bytes32 indexed authId, uint y);

    function register (uint n, uint v) returns (bytes32) {
        bytes32 id = sha3(msg.sender, block.number, n, v);
        if (n <= v) {
            throw;
        }
        keys[id].n = n;
        keys[id].v = v;
        KeyRegistered(id, n, v);
        return id;
    }

    function startAuthentication (bytes32 keyId, uint x) returns (bytes32) {
        bytes32 id = sha3(msg.sender, block.number, x);
        var authentication = authentications[id];
        authentication.keyId = keyId;
        authentication.x = x;
        authentication.e = new uint8[](1);
        for (var i = 0; i < 1; i++) {
            // random simulator (0 or 1)
            authentication.e[i] = uint8(uint160(sha3(msg.sender, block.number)) % 2);
        }
        AuthenticationStarted(id, x, authentication.e);
        return id;
    }

    function finishAuthentication (bytes32 authId, uint y) returns (bool){
        var auth = authentications[authId];
        var key = keys[auth.keyId];
        if ((y * y) % key.v != (auth.x * key.v**auth.e[0]) % key.v) {
            AuthenticationFinished(0, (auth.x * key.v**auth.e[0]) % key.v);
            return;
            /*throw;*/
        }
        AuthenticationFinished(authId, (auth.x * key.v**auth.e[0]) % key.v);
    }
}
