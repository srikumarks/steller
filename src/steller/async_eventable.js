define(["./eventable"], function (Eventable) {

    var kAsyncEventableKey = '__steller_async_eventable__';

    // A variant of Eventable where watchers will be triggered asynchronously.
    function AsyncEventable(obj) {
        obj = Eventable(obj);

        var on = obj.on;
        obj.on = function asyncOn(eventName, watcher) {
            ASSERT(arguments.length === 2);
            ASSERT(typeof(watcher) === 'function');

            if (!watcher) {
                return this;
            }

            var async = watcher[kAsyncEventableKey];

            if (!async) {
                Object.defineProperty(watcher, kAsyncEventableKey, {
                    value: (async = function () {
                        var argv = arguments;
                        setTimeout(function () { watcher.apply(obj, argv); }, 0);
                    }),
                        enumerable: false,
                    configurable: false,
                    writable: false
                });
            }

            on(eventName, async);
        };

        return obj;

    }

    return AsyncEventable;

});
