define(function () {
    var validEventName = (function () {
        var dummy = {};

        return function (eventName) {
            ASSERT(typeof(eventName) == 'string');
            if (dummy[eventName]) {
                throw new Error('Invalid event name - ' + eventName);
            }
            return eventName;
        };
    }());

    var nextEventableWatcherID = 1;

    // Backbone-like event support for objects.
    // Primary methods are obj.on, obj.off and obj.emit.
    // on/off manage watchers on events and emit emits them.
    function Eventable(obj) {
        var watchers = {};

        // on(eventName, watcher)
        //
        // Installs the given watchers (callbacks) for the specified
        // eventName. The watchers will all be called once the event 
        // is "emit"ed. The watchers will be passed the same argument-list
        // as the emit(..) call. The "this" context is set to `obj` inside
        // a watcher call.
        function on(eventName, watcher) {
            ASSERT(arguments.length === 2);
            ASSERT(typeof(watcher) === 'function');

            var i, N;

            eventName = validEventName(eventName);

            var eventWatchers = watchers[eventName] || (watchers[eventName] = {});

            var id = watcher['__steller_eventable_id__'] || 0;

            if (id in eventWatchers) {
                return this;
            }

            if (!id) {
                Object.defineProperty(watcher, '__steller_eventable_id__', {
                    value: (id = nextEventableWatcherID++),
                    enumerable: false,
                    configurable: false,
                    writable: false
                });
            }

            eventWatchers[id] = watcher;
            return this;
        }

        // off(eventName, watcher)
        //
        // Removes given watchers from the watch list. If no
        // watchers are given, removes all watchers associated with
        // the given event.
        function off(eventName, watcher) {
            ASSERT(arguments.length >= 1 && arguments.length <= 2);

            var i, N;

            eventName = validEventName(eventName);

            var eventWatchers = watchers[eventName];

            if (!eventWatchers) {
                return this;
            }

            var wid = (watcher && watcher['__steller_eventable_id__']) || 0;

            if (wid) {
                WARNIF(!eventWatchers[wid], "Watcher not found!");
                delete eventWatchers[wid];
            } else if (!watcher) {
                // Remove all watchers on the event.
                delete watchers[eventName];
            }

            return this;
        }

        // Fires off all watchers associated with the given event.
        // Exceptions in watcher handlers are all caught and logged
        // before the emit returns. Maybe I should make the
        // callbacks happen asynchronously, but as a first implementation.
        // this is likely ok.
        function emit(eventName) {
            eventName = validEventName(eventName);

            var eventWatchers = watchers[eventName];
            if (!eventWatchers) {
                // Nothing to do.
                return this;
            }

            for (var id in eventWatchers) {
                try {
                    eventWatchers[id].apply(this, arguments);
                } catch (e) {
                    LOG(1, "Exception in event watcher - ", e);
                }
            }

            return this;
        }

        ASSERT(!('on' in obj));
        ASSERT(!('off' in obj));
        ASSERT(!('emit' in obj));

        obj.on = on;
        obj.off = off;
        obj.emit = emit;

        return obj;
    }

    // Generic function to trap a method call and emit an event when
    // the method call completes.
    Eventable.observe = function (obj, methodName, eventName) {
        REQUIRE(obj.emit);

        eventName = validEventName(eventName || methodName);

        var method = obj[methodName];
        REQUIRE(typeof(method) === 'function');

        obj[methodName] = function () {
            var result = method.apply(this, arguments);

            var argv = Array.prototype.slice.call(arguments);
            argv.unshift(eventName);

            this.emit.apply(this, argv);

            return result;
        };

        return obj;
    };

    return Eventable;
});

