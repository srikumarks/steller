// nextTick function largely taken from Q.js by kriskowal.
//  repo: https://github.com/kriskowal/q
//  file: q.js
//
// The "new Image()" hack is from - http://www.nonblocking.io/2011/06/windownexttick.html
// Whoa! The original source of that hack is JSDeferred - https://github.com/cho45/jsdeferred
//
// Use the fastest possible means to execute a task in a future turn
// of the event loop.

var nextTick = (function () {
    if (
        typeof process !== "undefined" &&
        typeof process.nextTick === "function"
    ) {
        // node
        return process.nextTick;
    } else if (typeof setImmediate === "function") {
        // In IE10, or use https://github.com/NobleJS/setImmediate
        return setImmediate;
    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // linked list of tasks (single, with head node)
        var head = {},
            tail = head;
        channel.port1.onmessage = function () {
            head = head.next;
            var task = head.task;
            delete head.task;
            task();
        };
        return function (task) {
            tail = tail.next = { task: task };
            channel.port2.postMessage(0);
        };
    } else if (typeof Image !== "undefined") {
        // Fast hack for not so modern browsers.
        return function (task) {
            var img = new Image();
            img.onerror = task;
            img.src = "data:image/png," + Math.random();
        };
    } else {
        // Worst case.
        return function (task) {
            return setTimeout(task, 0);
        };
    }
})();

module.exports = nextTick;
