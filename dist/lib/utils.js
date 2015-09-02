var Utils = {};

Utils.marshalBuffer = function(buffer) {
    var str = "";
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return str;
};

Utils.unmarshalBuffer = function(str) {
    var len = str.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
};

Utils.marshal = function(message) {
    if (message.data instanceof ArrayBuffer) {
        message.data = this.marshalBuffer(message.data);
    }
    return JSON.stringify(message);
};

Utils.unmarshal = function(data) {
    var message = JSON.parse(data);
    if (message.hasOwnProperty('data')) {
        if (message.data !== "\n") {
            message.data = this.unmarshalBuffer(message.data);
        }
    }
    return message;
};

module.exports = Utilities;