'use strict';

/**
 * @fileOverview WebCDN - A Content Distribution Network from web browsers using WebRTC
 * @author Patrick Michelberger
 * @example
 * var webcdn = new WebCDN();
 * webcdn.init('ws://webcdn.michelberger.info:1337', function() { 
 *   console.log("Your WebCDN is ready!");
 * });
 * @see <a href="http://webcdn.michelberger.info">WebCDN project website</a>.
 */

window.webcdn_uuid = require('./lib/uuid.js')();

var sha1 = require('sha1');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Messenger = require('./lib/messenger.js');
var Tracker = require('./lib/tracker.js');
var Logger = require('./lib/logger.js');
var Download = require('./lib/download.js');
var Peernet = require('./lib/peernet.js');
var Statistics = require('./lib/statistics.js');
var getCurrentPosition = require('./lib/geo.js');

window.WebCDN = WebCDN;
inherits(WebCDN, EventEmitter);

/**
 * Creates a new WebCDN instance
 * @param config - configuration settings
 * @param {String} config.bucketUrl - Ressources have to be CORS-enables, for testing purposes mirror them in a configurable AWS bucket 
 * @param {Boolean} config.trackGeolocation - Use HTML5 Geolocation API to identify user's current position
 * @constructor
 */
function WebCDN(config) {
    var self = this;

    // Options
    config = config ||  {};
    this._bucketUrl = config.bucketUrl ||  false;
    this._trackGeolocation = config.trackGeolocation ||  false;
    this.DEBUG = config.debug || false;
    this.INTEGRITY_IS_ACTIVE = config.integrity || false;
    this.uuid = window.webcdn_uuid;

    // Assets & caches
    this._items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]')); // marked resources for WebCDN distribution

    // Dependencies
    this._logger = new Logger({
        debug: this.DEBUG
    });
    this._messenger = new Messenger({
        logger: this._logger
    });
    this._tracker = new Tracker({
        messenger: this._messenger,
        logger: this._logger
    });
    this._peernet = new Peernet({
        signalChannel: this._messenger,
        logger: this._logger
    });
};

/**
 * Initializes a WebCDN instance
 * @param {String} coordinatorUrl
 * @param {callback} callback - Fires the WebCDN client is ready and has connected to the coordinator
 * @public
 */
WebCDN.prototype.init = function(coordinatorUrl, callback) {
    var self = this;
    var id = getQueryId(coordinatorUrl);
    callback = callback || function() {};

    if (!id) {
        coordinatorUrl += "?id=" + this.uuid;
    } else {
        this.uuid = id;
    }

    // Geolocation available?
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

    // AWS bucket available?
    if (this._bucketUrl) {
        bucketizeResources(this._items, this._bucketUrl);
    }

    function connect(callback) {
        self._connect(coordinatorUrl, function() {
            self._initHashing(function(err) {
                self._initLookup();
                callback(err);
            });
        });
    };
};

/**
 * Load a resource with a given content hash
 * @param {String} hash resouce hash computed by _getItemHash()
 * @pubic
 */
WebCDN.prototype.load = function(hash) {
    var self = this;
    this._tracker.getInfo(hash, function(data) {
        var download = new Download(data.peerid, data.hash, data.contentHash, self._peernet, self._logger, function(data, err) {
            self.createObjectURLFromArrayBuffer(hash, data);
        });
        download.start();
    });
};

/**
 * Connect to a given WebCDN coordinator serve
 * @param {String} url coordinator's URL
 * @param {callback} callback
 * @private
 */
WebCDN.prototype._connect = function(url, callback) {
    this._messenger.connect(url, function() {
        callback();
    });
};

/**
 * Computes an unique hash value for each resource marked with a data-webcdn-callback attribute 
 * @private
 */
WebCDN.prototype._initHashing = function(callback) {
    var errors = [];
    this._items.forEach(function(item) {
        if (!item.dataset.hasOwnProperty("webcdnHash") && this.INTEGRITY_IS_ACTIVE) {
            errors.push(new Error("Missing webcdn hash for item " + item.dataset.webcdnFallback));
        } else if (item.dataset.hasOwnProperty("webcdnHash") && this.INTEGRITY_IS_ACTIVE) {
            // use precomputed hash for content identification and data integrity 
            item.dataset.webcdnContentHash = item.dataset.webcdnHash;
        } else {
            item.dataset.webcdnHash = this._getItemHash(item);
        }
    }, this);
    callback(errors);
};

/**
 * Computes an unique hash value for a given DOM object 
 * @param {Object} item DOM object
 * @private
 */
WebCDN.prototype._getItemHash = function(item) {
    var hash = sha1(item.dataset.webcdnFallback);
    return hash;
};

/**
 * Iterates about each marked WebCDN items and executes a "lookup" request to the coordinator
 * @private
 */
WebCDN.prototype._initLookup = function() {
    this._items.forEach(function(item) {
        if (item.dataset.hasOwnProperty("webcdnHash")) {
            this.load(item.dataset.webcdnHash);
        }
    }, this);
};

/**
 * Querys user's current location and sends it to the coordinator server
 * @private
 */
WebCDN.prototype._sendGeolocation = function() {
    var self = this;
    getCurrentPosition(function(err, position) {
        if (!err && position) {
            self._messenger.send('geolocation', position);
        }
    });
};

/**
 * @function createObjectURLFromArrayBuffer
 * @param {DOMElement} element
 * @param {ArrayBuffer} arrayBuffer
 */
WebCDN.prototype.createObjectURLFromArrayBuffer = function(hash, arraybuffer) {
    var blob;
    var element = document.querySelector('[data-webcdn-hash="' + hash + '"]');
    switch (element.tagName) {
        case 'IMG':
            blob = new Blob([arraybuffer], {
                type: 'application/octet-stream'
            });
            element.src = window.URL.createObjectURL(blob);
            break;
        case 'SCRIPT':
            blob = new Blob([arraybuffer], {
                type: 'text/javascript'
            });
            element.src = window.URL.createObjectURL(blob);
            break;
        case 'LINK':
            blob = new Blob([arraybuffer], {
                type: 'text/css'
            });
            element.rel = "stylesheet";
            element.href = window.URL.createObjectURL(blob);
            break;
        default:
            blob = new Blob([arraybuffers], {
                type: 'application/octet-stream'
            });
            element.src = window.URL.createObjectURL(blob);
    };

    // Update coordinator
    this._update([{
        hash: hash,
        size: arraybuffer.byteLength,
        contentHash: element.dataset.webcdnContentHash
    }]);
};

/**
 * Send a "update" message to inform the coordinator about stored items
 * @param {Array} hashes Content hashes computed by _getItemHash()
 * @private
 */
WebCDN.prototype._update = function(hashes) {
    this._messenger.send('update', hashes);
};

/**
 * Returns query id from a given URL string
 * @function getQueryId
 * @param {String} url
 * @returns {String}
 */
function getQueryId(url) {
    var regex = /\?id=(\d*)/;
    var result = regex.exec(url);
    if (result && result[1]) {
        return result[1];
    } else {
        return false;
    }
};

/**
 * Updates fallback URL of each element in the given array with a defined bucketUrl
 * @function bucketizeResource
 * @param {Array} DOMelements array of DOM elements with WebCDN fallback URL
 * @param {String} bucketUrl
 */
function bucketizeResources(DOMelements, bucketUrl) {
    DOMelements.forEach(function(element) {
        if (element.dataset.webcdnFallback.charAt(0) === '/') {
            element.dataset.webcdnFallback = element.dataset.webcdnFallback.slice(1);
        }
        element.dataset.webcdnFallback = bucketUrl + element.dataset.webcdnFallback.replace(/.*:?\/\//g, "");
    });
};
