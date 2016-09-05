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
        int n;
        int[] v;
    }

    struct Authentication {
        bytes32 keyId;
        int x;
        uint8[] e;
    }

    mapping (bytes32 => Key) keys;
    mapping (bytes32 => Authentication) authentications;

    event KeyRegistered(bytes32 indexed keyId, int n, int[] v);
    event AuthenticationStarted(bytes32 indexed authId, int x, uint8[] e);
    event AuthenticationFinished(bytes32 indexed authId, int y);

    function register (int n, int[] v) returns (bytes32) {
        bytes32 id = sha3(msg.sender, block.number, n, v);
        /*if (n <= v) {
            throw;
        }*/
        keys[id].n = n;
        keys[id].v = v;
        KeyRegistered(id, n, v);
        return id;
    }

    function startAuthentication (bytes32 keyId, int x) returns (bytes32) {
        bytes32 authId = sha3(msg.sender, block.number, x);
        var authentication = authentications[authId];
        authentication.keyId = keyId;
        authentication.x = x;
        authentication.e = new uint8[](keys[keyId].v.length);
        for (var i = 0; i < keys[keyId].v.length; i++) {
            // random simulator (0 or 1)
            authentication.e[i] = uint8(uint160(sha3(msg.sender, block.number, i)) % 2);
        }
        AuthenticationStarted(authId, x, authentication.e);
        return authId;
    }

    function finishAuthentication (bytes32 authId, int y) returns (bool){
        var auth = authentications[authId];
        var key = keys[auth.keyId];
        int expected = auth.x;
        for (var i = 0; i < key.v.length; i++) {
            expected = (expected * ((key.v[i] ** auth.e[i]) % key.n)) % key.n;
        }
        // expected = expected % key.n;
        int delivered = (y * y) % key.n;
        if (delivered != expected && delivered != -expected) {
            throw;
        }
        AuthenticationFinished(authId, y);
    }
}
