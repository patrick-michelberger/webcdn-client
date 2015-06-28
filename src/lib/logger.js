module.exports = Logger;

function Logger() {};

Logger.prototype.trace = function(text, data) {
    //console.log((performance.now() / 1000).toFixed(3) + ": " + text);
    console.log(text, data);
};
