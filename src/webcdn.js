'use strict';
var sha1 = require('sha1');
var UUID = require('./lib/uuid.js');
var Messenger = require('./lib/messenger.js');
var Peernet = require('./lib/peernet.js');
var Logger = require('./lib/logger.js');
var getCurrentPosition = require('./lib/geo.js');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

(function(window) {

    window.logger = new Logger();

    inherits(WebCDN, EventEmitter);
    
    function WebCDN(config) {
        config = config ||  {};
        var self = this;
        this._bucketUrl = config.bucketUrl ||  false;
        this._trackGeolocation = config.trackGeolocation ||  false;
        this._items = {};
        this._hashes = [];
        this._messenger = new Messenger();
        this._peernet = new Peernet({
            signalChannel: this._messenger
        });

        this._messenger.on('lookup-response', function(data) {
            if (data.peerid) {
                var peer = self._peernet.createConnection(data.peerid, data.hash);
                peer.doOffer();
            } else {
                // CDN Fallback
                self._loadImageByCDN(data.hash);
            }
        });
    };

    WebCDN.prototype.init = function(coordinatorUrl, callback) {
        var self = this;
        var id = getQueryId(coordinatorUrl)

        this.uuid = id ||  UUID();
        if (!id) {
            coordinatorUrl += "?id=" + self.uuid;
        }

        if (this._trackGeolocation) {
            this.emit('geolocation:start');
            getCurrentPosition(function(err, position) {
                self.emit('geolocation:end');
                if (!err && position) {
                    coordinatorUrl += '&lat=' + position.latitude + '&lon=' + position.longitude;
                }
                connect(callback);
            });
        } else {
            connect(callback);
        }

        function connect(callback) {
            self.connect(coordinatorUrl, function() {
                self._initHashing();
                self._initLookup();
                callback();
            });
        };
    };

    WebCDN.prototype.connect = function(coordinatorUrl, callback) {
        this._messenger.connect(coordinatorUrl, function() {
            callback();
        });
    };

    WebCDN.prototype.load = function(content_hash) {
        this._lookup(content_hash);
    };

    WebCDN.prototype._initHashing = function() {
        var self = this;
        var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
        items.forEach(function(item) {
            var hash = self._getItemHash(item);
            self._hashes.push(hash);
            self._items[hash] = item.id;
            item.dataset.webcdnHash = hash;
        });
    };

    WebCDN.prototype._getItemHash = function(item) {
        var hash = sha1(item.dataset.webcdnFallback);
        return hash;
    };

    WebCDN.prototype._update = function(hashes) {
        this._messenger.send('update', hashes);
    };

    WebCDN.prototype._initLookup = function() {
        for (var hash in this._items) {
            this.load(hash);
        }
    };

    WebCDN.prototype._lookup = function(hash) {
        this._messenger.send('lookup', hash);
    };

    WebCDN.prototype._loadImageByCDN = function(hash) {
        var self = this;
        var element = document.querySelector('[data-webcdn-hash="' + hash + '"]')
        element.onload = function() {
            self._update([hash]);
        };
        if (this._bucketUrl) {
            if (element.dataset.webcdnFallback.charAt(0) === '/') {
                element.dataset.webcdnFallback = element.dataset.webcdnFallback.slice(1);
            }
            element.dataset.webcdnFallback = this._bucketUrl + element.dataset.webcdnFallback.replace(/.*:?\/\//g, "");
        }
        getBase64FromImage(element.dataset.webcdnFallback, function(base64) {
            element.src = base64;
        }, function() {
            element.src = element.dataset.webcdnFallback;
        });
    };

    WebCDN.prototype._sendGeolocation = function() {
        var self = this;
        getCurrentPosition(function(err, position) {
            if (!err && position) {
                self._messenger.send('geolocation', position);
            }
        });
    };


    // helpers
    function getImageData(domElement) {
        var canvas = document.createElement('canvas');
        canvas.width = domElement.width;
        canvas.height = domElement.height;
        var context = canvas.getContext('2d');
        context.drawImage(domElement, 0, 0, domElement.width, domElement.height);
        var data = canvas.toDataURL("image/jpeg");
        return data;
    };

    function getBase64FromImage(url, onSuccess, onError) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", url);
        xhr.onload = function() {
            var base64, binary, bytes, mediaType;

            bytes = new Uint8Array(xhr.response);
            //NOTE String.fromCharCode.apply(String, ...
            //may cause "Maximum call stack size exceeded"
            binary = [].map.call(bytes, function(byte) {
                return String.fromCharCode(byte);
            }).join('');
            mediaType = xhr.getResponseHeader('content-type');
            base64 = [
                'data:',
                mediaType ? mediaType + ';' : '',
                'base64,',
                btoa(binary)
            ].join('');
            onSuccess(base64);
        };
        xhr.onerror = onError;
        xhr.send();
    };

    function getQueryId(url) {
        var regex = /\?id=(\d*)/;
        var result = regex.exec(url);
        if (result && result[1]) {
            return result[1];
        } else {
            return false;
        }
    };

    window.WebCDN = WebCDN;
})(window);
