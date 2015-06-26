'use strict';

var sha1 = require('sha1');
var Messenger = require('./lib/messenger.js');

(function(window) {

    function WebCDN(config) {
        // Private attributes
        var self = this;
        var uuid = UUID();
        var events = [];

        this._hashs = [];
        this._messenger = new Messenger();

        self.init = function() {
            self._initHashing();
        };

        self.connect = function(coordinator) {
            self._messenger.connect(coordinator, function() {   
                console.log("hash_list: ", self._hashs);
                self._update(self._hashs);
            });
        };

        self.load = function(content_hash, id) {

        };

        self._initHashing = function() {
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
                var hash = self._getItemHash(item);
                self._hashs.push(hash);
                item.dataset.webcdnHash = hash;
            });
        };

        self._getItemHash = function(item) {
            var data = getImageData(item);
            var hash = sha1(data);
            return hash;
        };

        self._update = function(hashes) {
            self._messenger.send('update', hashes);
        };

        self._lookup = function(hash) {
            self._messenger.send('lookup', hash);
        };
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

    function trace(text) {
        //console.log((performance.now() / 1000).toFixed(3) + ": " + text);
        console.log(text);
    };

    // Generate UUID
    var UUID = (function() {
        function b(
            a // placeholder
        ) {
            return a // if the placeholder was passed, return
                ? ( // a random number from 0 to 15
                    a ^ // unless b is 8,
                    Math.random() // in which case
                    * 16 // a random number from
                    >> a / 4 // 8 to 11
                ).toString(16) // in hexadecimal
                : ( // or otherwise a concatenated string:
                    [1e7] + // 10000000 +
                    -1e3 + // -1000 +
                    -4e3 + // -4000 +
                    -8e3 + // -80000000 +
                    -1e11 // -100000000000,
                ).replace( // replacing
                    /[018]/g, // zeroes, ones, and eights with
                    b // random hex digits
                )
        }
        return b;
    })();

    window.WebCDN = WebCDN;
})(window);
