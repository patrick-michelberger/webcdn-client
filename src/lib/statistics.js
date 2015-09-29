var url = "ws://localhost:9000?id=" + window.webcdn_uuid;
var ws = createWebsocket();
var Resource = require('./resource.js');

/**
 * Statistics module 
 * @constructor 
 */

var Statistics = {};
Statistics.WS_CONNECT_DURATION = false;
Statistics.PC_CONNECT_DURATION = false;
Statistics.resources = {}; // .resources[hash] = Resource

/**
 * Register current peer to the mediator server
 * @static
 */
Statistics.addHost = function() {
    var data = {
        "uuid": window.webcdn_uuid,
        "active": true
    };
    Statistics.sendMessage("host:add", data);
};

/**
 * Send timing data to the mediator
 * @static
 */
Statistics.sendTimingData = function() {
    if (window.performance && window.performance.timing) {
        var data = window.performance.timing.toJSON();
        data.page_load = data.loadEventEnd - data.navigationStart;
        Statistics.sendMessage("plain:timing", data);
    }
};

/**
 * Remove current peer from the mediator server
 * @static
 */
Statistics.removeHost = function() {
    var data = {
        "uuid": window.webcdn_uuid
    };
    Statistics.sendMessage("host:remove", data);
};

/**
 * Send message to the mediator server
 * @param {String} type - message type 
 * @param {Object} data - message payload 
 * @static
 */
Statistics.sendMessage = function(type, data) {
    var message = {
        type: type,
        data: data
    };
    ws.send(JSON.stringify(message));
};

/**
 * Request timing information for website's resources.
 * @param {String} name - resource name e.g. URL 
 * @static
 */
Statistics.queryResourceTiming = function(name) {
    if (!('performance' in window) ||
        !('getEntriesByType' in window.performance) ||
        !(window.performance.getEntriesByType('resource') instanceof Array)
    ) {
        // API not supported
    } else {
        // API supported. Hurray!   
        var timings = window.performance.getEntriesByName(name);

        if (timings && timings[0]) {
            var data = {
                name: timings[0].name,
                initiatorType: timings[0].initiatorType,
                entryType: timings[0].entryType,
                fetchStart: timings[0].fetchStart,
                responseStart: timings[0].responseStart,
                responseEnd: timings[0].responseEnd,
                duration: timings[0].duration,
                startTime: timings[0].startTime,
                uuid: window.webcdn_uuid
            };
            Statistics.sendMessage('resource_timing', data);
        }
    }
};

/** 
 * Sets performance timing mark
 * @param {String} name - mark's name 
 * @static
 */
Statistics.mark = function(name) {
    if (window.performance && window.performance.mark) {
        window.performance.mark(name);
    }
};

Statistics.measureByType = function(type, hash, peerid)  {
    console.log("measure " + type + " with hash " + hash);
    var name = duration = type + "_duration";
    var start = type + "_start";
    var end = type + "_end";

    if (hash) {
        name += ":" + hash;
        start += ":" + hash;
        end += ":" + hash;
    }

    // Measure
    window.performance.measure(name, start, end);

    // Query Measure
    var result = window.performance.getEntriesByName(name);

    if (result && result[0]) {
        if (type !== "ws_connect" && type !== "pc_connect" && hash) {
            var resource = Statistics.resources[hash] = this._createResource(hash);
            if (type === "lookup") {
                resource.setProperty("ws_connect", Statistics.WS_CONNECT_DURATION);
            }
            if (type === "fetch") {
                resource.setProperty("seeder", peerid);
            }
            resource.setProperty(type, result[0].duration);

            if (type === "cdn_fallback" || type === "fetch") {
                // send data to statistics server 
                var data = JSON.stringify(resource);
                console.log(data);
                Statistics.sendMessage(duration, data);
            }
        }
        return result[0].duration;
    } else {
        return false;
    }
};

/**
 * Iterates over all timing marks, computes the respective measures and sends them to the mediator.
 * @static
 */

Statistics.measure = function() {
    window.performance.getEntriesByType('mark').forEach(function(mark) {
        var arr = mark.name.split(":");
        var type = arr[0];
        var id = arr[1];
        if (type === "lookup_start") {
            window.performance.measure("lookup_duration:" + id, "lookup_start:" + id, "lookup_end:" + id);
        }
        if (type === "pc_connect_start") {
            window.performance.measure("pc_connect_duration:" + id, "pc_connect_start:" + id, "pc_connect_end:" + id);
        }
        if (type === "fetch_start") {
            window.performance.measure("fetch_duration:" + id, "fetch_start:" + id, "fetch_end:" + id);
        }
    });
    var measures = window.performance.getEntriesByType('measure');

    measures.forEach(function(measure) {
        var arr = measure.name.split(":");
        var type = arr[0];
        var hash = arr[1];
        var data = {
            uuid: window.webcdn_uuid,
            hash: hash,
            duration: measure.duration
        };
        Statistics.sendMessage(type, data);
    });
};

Statistics._createResource = function(hash) {
    if (Statistics.resources && Statistics.resources[hash]) {
        return Statistics.resources[hash];
    }
    return new Resource(hash, Statistics.WS_CONNECT_DURATION);
};


function createWebsocket()  {
    var ws = new WebSocket(url);

    ws.onmessage = function(event) {
        var msg = JSON.parse(event.data);
    };

    ws.onopen = function(event) {};

    return ws;
};

window.WebCDNStatistics = Statistics;
module.exports = Statistics;
