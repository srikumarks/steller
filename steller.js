var LOG_LEVEL = 1;
org = typeof(org) === 'undefined' ? {} : org;
org.anclab = org.anclab || {};
org.anclab.steller = org.anclab.steller || {};
(function (window, steller) {
var validEventName = (function () {
    var dummy = {};
    return function (eventName) {
        ;
        if (dummy[eventName]) {
            throw new Error('Invalid event name - ' + eventName);
        }
        return eventName;
    };
}());
var nextEventableWatcherID = 1;




function Eventable(obj) {
    var watchers = {};
    function on(eventName, watcher) {
        ;
        ;
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
    function off(eventName, watcher) {
        ;
        var i, N;
        eventName = validEventName(eventName);
        var eventWatchers = watchers[eventName];
        if (!eventWatchers) {
            return this;
        }
        var wid = (watcher && watcher['__steller_eventable_id__']) || 0;
        if (wid) {
            ;
            delete eventWatchers[wid];
        } else if (!watcher) {
            delete watchers[eventName];
        }
        return this;
    }
    function emit(eventName) {
        eventName = validEventName(eventName);
        var eventWatchers = watchers[eventName];
        if (!eventWatchers) {
            return this;
        }
        for (var id in eventWatchers) {
            try {
                eventWatchers[id].apply(this, arguments);
            } catch (e) {
                do { if (1 <= LOG_LEVEL) { console.log("eventable.js" + '[' + 107 + ']:\t', "Exception in event watcher - ", e); } } while (false);
            }
        }
        return this;
    }
    ;
    ;
    ;
    obj.on = on;
    obj.off = off;
    obj.emit = emit;
    return obj;
}
Eventable.observe = function (obj, methodName, eventName) {
    ;
    eventName = validEventName(eventName || methodName);
    var method = obj[methodName];
    ;
    obj[methodName] = function () {
        var result = method.apply(this, arguments);
        var argv = Array.prototype.slice.call(arguments);
        argv.unshift(eventName);
        this.emit.apply(this, argv);
        return result;
    };
    return obj;
};
var kAsyncEventableKey = '__steller_async_eventable__';
function AsyncEventable(obj) {
    obj = Eventable(obj);
    var on = obj.on;
    obj.on = function asyncOn(eventName, watcher) {
        ;
        ;
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
var GraphNode = (function () {
    function GraphNode(node, inputs, outputs) {
        node.inputs = inputs || [];
        node.outputs = outputs || [];
        node.numberOfInputs = node.inputs.length;
        node.numberOfOutputs = node.outputs.length;
        ;
        node.context = (node.inputs[0] && node.inputs[0].context) || (node.outputs[0] && node.outputs[0].context);
        ;
        node.connect = function (target, outIx, inIx) {
            var i, N, inPin, outPin;
            target = target || node.context.destination;
            outIx = outIx || 0;
            inIx = inIx || 0;
            outPin = node.outputs[outIx];
            inPin = target.inputs ? target.inputs[inIx] : target;
            if (inPin.constructor.name === 'AudioParam' || inPin.constructor.name === 'AudioGain') {
                outPin.connect(inPin);
            } else if (inPin.numberOfInputs === outPin.numberOfOutputs) {
                for (i = 0, N = inPin.numberOfInputs; i < N; ++i) {
                    outPin.connect(inPin, i, i);
                }
            } else {
                outPin.connect(inPin);
            }
            return node;
        };
        node.disconnect = function () {
            if (arguments.length > 0) {
                Array.prototype.forEach.call(arguments, function (n) {
                    node.outputs[n].disconnect();
                });
            } else {
                node.outputs.forEach(function (n) { n.disconnect(); });
            }
            return node;
        };
        var preservedNodes = {};
        var thisNodeID = getOrAssignNodeID(node);
        node.keep = function (childNode) {
            var theNode = childNode || node;
            var id = getOrAssignNodeID(theNode);
            preservedNodes[id] = theNode;
            return theNode;
        };
        node.drop = function (childNode) {
            if (childNode) {
                var id = getOrAssignNodeID(childNode);
                delete preservedNodes[id];
            } else {
                delete GraphNode._preservedNodes[thisNodeID];
            }
        };
        GraphNode._preservedNodes[thisNodeID] = preservedNodes;
        return node;
    }
    var nextNodeID = 1;
    var nodeIDKey = '#org.anclab.steller.GraphNode.globalid';
    function getOrAssignNodeID(node) {
        var id = node[nodeIDKey];
        if (!id) {
            id = nextNodeID++;
            Object.defineProperty(node, nodeIDKey, {
                value: id,
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
        return id;
    }
    GraphNode._preservedNodes = {};
    GraphNode.chain = function (nodes) {
        var i, N;
        for (i = 0, N = nodes.length - 1; i < N; ++i) {
            nodes[i].connect(nodes[i+1]);
        }
        return GraphNode;
    };
    return GraphNode;
}());
function Param(spec) {
    var self = Object.create(Param.prototype);
    self.spec = spec = processOptionsParam(Object.create(spec));
    self.getter = undefined;
    self.setter = undefined;
    self.valueOf = undefined;
    self.audioParam = undefined;
    self.watchers = [];
    self._value = undefined;
    if (spec.audioParam) {
        self.audioParam = spec.audioParam;
        self.getter = spec.getter || Param.getters.audioParam;
        self.setter = spec.setter || Param.setters.audioParam;
    } else if (spec.options) {
        self.getter = spec.getter || Param.getters.value;
        self.setter = spec.setter || Param.setters.option;
    } else {
        self.getter = spec.getter || Param.getters.value;
        self.setter = spec.setter || Param.setters.value;
    }
    self.valueOf = self.getter;
    if ('value' in spec) {
        self.setter(spec.value);
    }
    return self;
}
function processOptionsParam(spec) {
    if (spec.options) {
        var hash = {};
        spec.options.forEach(function (o, i) {
            hash['option:' + o] = i + 1;
        });
        spec.limit = function (val) {
            if (typeof val === 'number') {
                if (val >= 0 && val < spec.options.length) {
                    return spec.options[val];
                }
                throw new Error('Invalid enumeration index');
            }
            if (hash['option:' + val]) {
                return val;
            }
            throw new Error('Invalid enumeration value');
        };
    }
    return spec;
}
Param.getters = {
    value: function () {
        return this._value;
    },
    audioParam: function () {
        return this.audioParam.value;
    }
};
Param.setters = {
    value: function (v) {
        return (this._value = v);
    },
    audioParam: function (v) {
        return (this.audioParam.value = v);
    },
    option: function (v) {
        return (this._value = this.spec.limit(v));
    }
};
Param.mappings = {};
Param.mappings.linear = {
    fromNorm: function (p, f) {
        return p.spec.min + f * (p.spec.max - p.spec.min);
    },
    toNorm: function (p) {
        return (p.value - p.spec.min) / (p.spec.max - p.spec.min);
    }
};
Param.mappings.log = {
    fromNorm: function (p, f) {
        var spec = p.spec;
        var lmin = Math.log(spec.min);
        var lmax = Math.log(spec.max);
        return Math.exp(lmin + f * (lmax - lmin));
    },
    toNorm: function (p) {
        var spec = p.spec;
        var lmin = Math.log(spec.min);
        var lmax = Math.log(spec.max);
        var lval = Math.log(p.value);
        return (lval - lmin) / (lmax - lmin);
    }
};
Param.names = function (obj) {
    return Object.keys(obj).filter(function (k) {
        return obj[k] instanceof Param;
    });
};
Param.expose = function (obj1, obj2, listOfParamNames) {
    if (!listOfParamNames) {
        listOfParamNames = Param.names(obj1);
    }
    listOfParamNames.forEach(function (n) {
        ;
        obj2[n] = obj1[n];
    });
    return Param;
};
Param.bind = function (p1, p2, sh) {
    if (p1 instanceof Param) {
        p1.bind(p2, sh);
    } else if ('value' in p1) {
        if (sh) {
            sh.update(function () {
                p2.value = p1.value;
            });
        } else {
            p2.value = p1.value;
        }
    } else {
        if (sh) {
            sh.update(function () {
                p2.value = p1;
            });
        } else {
            p2.value = p1;
        }
    }
    return Param;
};
Param.prototype.__defineGetter__('value', function () {
    return this.getter();
});
Param.prototype.__defineSetter__('value', function (val) {
    if (val !== this.getter()) {
        return observeParam(this, this.setter(val));
    } else {
        return val;
    }
});
function observeParam(param, val) {
    var i, N, watchers = param.watchers;
    for (i = 0, N = watchers.length; i < N; ++i) {
        watchers[i](val, param);
    }
    return val;
}
Param.prototype.watch = function (callback) {
    var i, N, watchers = this.watchers;
    for (i = 0, N = watchers.length; i < N; ++i) {
        if (watchers[i] === callback) {
            return this;
        }
    }
    watchers.push(callback);
    return this;
};
Param.prototype.unwatch = function (callback) {
    var watchers = this.watchers;
    if (arguments.length < 1 || !callback) {
        watchers.splice(0, watchers.length);
        return this;
    }
    for (var i = watchers.length - 1; i >= 0; --i) {
        if (watchers[i] === callback) {
            watchers.splice(i, 1);
            return this;
        }
    }
    return this;
};
Param.prototype.changed = function () {
    observeParam(this, this.getter());
    return this;
};
Param.prototype.alias = function (name, label) {
    ;
    var self = this;
    var p = Object.create(self);
    p.spec = Object.create(self.spec);
    p.spec.name = name;
    if (label) {
        p.spec.label = label;
    }
    p.getter = function () { return self.getter(); };
    p.setter = function (val) { return self.setter(val); };
    p.alias = function (name, label) { return self.alias(name, label); };
    return p;
};
Param.prototype.bind = function (elem, sh) {
    var param = this;
    if (elem.addEventListener) {
        var spec = param.spec;
        var mapfn = spec.mapping ? Param.mappings[spec.mapping] : Param.mappings.linear;
        var updater;
        var onchange, updateElem;
        if (elem.type === 'checkbox') {
            updater = function () {
                param.value = elem.checked ? 1 : 0;
            };
            onchange = sh ? (function () { sh.update(updater); }) : updater;
            updateElem = function (v) {
                elem.checked = v ? true : false;
            };
        } else if (elem.type === 'range') {
            updater = function () {
                param.value = mapfn.fromNorm(param, parseFloat(elem.value));
            };
            onchange = sh ? (function () { sh.update(updater); }) : updater;
            updateElem = function (v) {
                elem.value = mapfn.toNorm(param);
            };
        } else {
            throw new Error('org.anclab.steller.Param.bind: Unsupported control type - ' + elem.type);
        }
        updateElem.elem = elem;
        updateElem.unbind = function () {
            elem.removeEventListener(onchange);
            param.unwatch(updateElem);
        };
        elem.addEventListener('change', onchange);
        param.watch(updateElem);
        updateElem(param.value);
    } else if (typeof elem === 'string') {
        var elems = document.querySelectorAll(elem);
        var i, N;
        for (i = 0, N = elems.length; i < N; ++i) {
            this.bind(elems[i]);
        }
    } else {
        function updateValueElem(v) {
            elem.value = v;
        }
        updateValueElem.elem = elem;
        updateValueElem.unbind = function () {
            param.unwatch(updateValueElem);
        };
        param.watch(updateValueElem);
        elem.value = param.value;
    }
    return this;
};
Param.prototype.unbind = function (elem) {
    if (typeof elem === 'string') {
        var elems = document.querySelectorAll(elem);
        var i, N;
        for (i = 0, N = elems.length; i < N; ++i) {
            this.unbind(elems[i]);
        }
    } else {
        var i, N, watchers = this.watchers;
        for (i = 0, N = watchers.length; i < N; ++i) {
            if (watchers[i].elem === elem) {
                watchers[i].unbind();
                return this;
            }
        }
    }
    return this;
};
function Queue(name) {
    var length = 0,
        maxLength = 4,
        store = [null,null,null,null],
        removeAt = -1,
        addAt = 0;
    function add(x) {
        if (length >= maxLength) {
            var newStore = new Array(maxLength * 2);
            var i, j, N, M;
            for (i = removeAt, j = 0, N = length, M = maxLength; j < N; ++j, i = (i + 1) % M) {
                newStore[j] = store[i];
            }
            store = newStore;
            addAt = length;
            removeAt = length === 0 ? -1 : 0;
            maxLength *= 2;
        }
        store[addAt] = x;
        if (removeAt < 0) {
            removeAt = addAt;
        }
        addAt = (addAt + 1) % maxLength;
        return this.length = length = (length + 1);
    }
    function remove() {
        if (length <= 0) {
            throw new Error('Empty queue');
        }
        var x = store[removeAt];
        store[removeAt] = null;
        removeAt = (removeAt + 1) % maxLength;
        this.length = length = (length - 1);
        return x;
    }
    function clear() {
        this.length = length = 0;
        store.splice(0, store.length, null, null, null, null);
        maxLength = 4;
        removeAt = -1;
        addAt = 0;
    }
    this.length = 0;
    this.add = add;
    this.remove = remove;
    this.clear = clear;
    return this;
}
function PeriodicTimer(callback, precision_ms) {
    var requestAnimationFrame = getRequestAnimationFrameFunc();
    if (detectBrowserEnv() && !requestAnimationFrame) {
        throw new Error('PeriodicTimer needs requestAnimationFrame support. Use a sufficiently modern browser.');
    }
    var self = this;
    var running = false;
    var intervalID;
    if (precision_ms === undefined) {
        precision_ms = 15;
    } else {
        precision_ms = Math.min(Math.max(detectBrowserEnv() ? 15 : 1, precision_ms), 33);
    }
    if (requestAnimationFrame && precision_ms >= 12) {
        self.start = function () {
            if (!running) {
                running = true;
                requestAnimationFrame(function () {
                    if (running) {
                        requestAnimationFrame(arguments.callee);
                        callback();
                    }
                });
            }
        };
        self.stop = function () {
            running = false;
        };
    } else {
        self.start = function () {
            if (!running) {
                running = true;
                intervalID = setInterval(callback, 1);
            }
        };
        self.stop = function () {
            if (running) {
                running = false;
                clearInterval(intervalID);
                intervalID = undefined;
            }
        };
    }
    self.__defineGetter__('running', function () { return running; });
    self.__defineSetter__('running', function (state) {
        if (state) {
            self.start();
        } else {
            self.stop();
        }
        return running;
    });
    ;
    self.computeAheadInterval_secs = (Math.round(precision_ms * 3.333)) / 1000;
    return self;
}
function preserveNode(node) {
    (window.JSNodeTimer_jsnodes || (window.JSNodeTimer_jsnodes = [])).push(node);
}
function JSNodeTimer(callback, precision_ms, audioContext) {
    if (audioContext) {
        var kBufferSize = 1024;
        var jsnode = audioContext.createJavaScriptNode(kBufferSize);
        jsnode.onaudioprocess = function (event) {
            callback();
        };
        var self = this;
        var running = false;
        preserveNode(jsnode);
        self.start = function () {
            if (!running) {
                running = true;
                jsnode.connect(audioContext.destination);
            }
        };
        self.stop = function () {
            if (running) {
                jsnode.disconnect();
                running = false;
            }
        };
        self.__defineGetter__('running', function () { return running; });
        self.__defineSetter__('running', function (val) {
            if (val) {
                self.start();
            } else {
                self.stop();
            }
            return running;
        });
        self.computeAheadInterval_secs = (Math.round(kBufferSize * 2.5)) / audioContext.sampleRate;
        return self;
    } else {
        return PeriodicTimer.call(this, callback, precision_ms);
    }
}
function Clock(t, tr, dt, rate) {
    this.dt = dt;
    this.t1 = t;
    this.t2 = t + dt;
    this.t1r = tr;
    this.t2r = tr + rate.valueOf() * dt;
    this.rate = rate;
    this.data = null;
    return this;
}
function ms(t) {
    return Math.round(t * 1000) / 1000;
}
Clock.prototype.toString = function () {
    return JSON.stringify([this.t1r, this.t2r - this.t1r, this.t1, this.t2 - this.t1].map(ms));
};
Clock.prototype.copy = function () {
    var c = new Clock(this.t1, this.t1r, this.dt, this.rate);
    if (this.data) {
        c.data = Object.create(this.data);
    }
    return c;
};
Clock.prototype.advance = function (dt) {
    this.t1 += dt;
    this.t2 += dt;
    return this;
};
Clock.prototype.advanceTo = function (t) {
    return this.advance(t - this.t1);
};
Clock.prototype.tick = function () {
    this.t1 = this.t2;
    this.t2 += this.dt;
    this.t1r = this.t2r;
    this.t2r += this.dt * this.rate.valueOf();
    return this;
};
Clock.prototype.jumpTo = function (t) {
    var step_dt = t - this.t1;
    var step_dtr = step_dt * this.rate.valueOf();
    this.t1 += step_dt;
    this.t2 += step_dt;
    this.t1r += step_dtr;
    this.t2r += step_dtr;
    return this;
};
Clock.prototype.syncWith = function (clock) {
    this.t1 = clock.t1;
    this.t2 = this.t1 + this.dt;
    this.t1r = clock.t1r;
    this.t2r = this.t1r + this.rate.valueOf() * this.dt;
    return this;
};
Clock.prototype.nudgeToRel = function (tr) {
    tr = Math.max(this.t1r, tr);
    if (this.t2r > this.t1r) {
        this.t1 += (tr - this.t1r) * (this.t2 - this.t1) / (this.t2r - this.t1r);
    }
    this.t1r = tr;
    return this;
};
Clock.prototype.rel2abs = function (rel) {
    return this.t1 + (rel - this.t1r) / this.rate.valueOf();
};
Clock.prototype.abs2rel = function (abs) {
    return this.t1r + (abs - this.t1) * this.rate.valueOf();
};
function Scheduler(audioContext, options) {
    var self = (this === window ? {} : this);
    var Timer = PeriodicTimer;
    var requestAnimationFrame = getRequestAnimationFrameFunc();
    var AudioContext = getAudioContext();
    if (detectBrowserEnv() && !requestAnimationFrame) {
        throw new Error('Scheduler needs requestAnimationFrame support. Use a sufficiently modern browser version.');
    }
    var instant_secs = 0.001;
    var time_secs = (function () {
        if (!audioContext) {
            return getHighResPerfTimeFunc() || (function () { return Date.now() * 0.001; });
        } else if (audioContext.createGain || audioContext.createGainNode) {
            instant_secs = 1 / audioContext.sampleRate;
            audioContext.createGain = audioContext.createGainNode = (audioContext.createGain || audioContext.createGainNode);
            audioContext.createGainNode();
            return function () {
                return audioContext.currentTime;
            };
        } else {
            throw new Error("Scheduler: Argument is not an audio context");
        }
    }());
    var timer, running = false;
    self.__defineGetter__('running', function () { return running; });
    self.__defineSetter__('running', function (state) {
        if (state) {
            if (!running) {
                running = true;
                mainClock.advanceTo(time_secs());
                timer.start();
            }
        } else {
            running = false;
            timer.stop();
        }
    });
    self.frame_rate = Param({min: 15, max: 75, value: 60});
    var queue = new Queue('tick');
    var fqueue = new Queue('frames');
    var uqueue = new Queue('update');
    function cancel() {
        uqueue.clear();
        queue.clear();
        fqueue.clear();
    }
    timer = new Timer(scheduleTick, 0, audioContext);
    var kFrameInterval = 1/60;
    var kFrameAdvance = kFrameInterval;
    var clockDt = timer.computeAheadInterval_secs || 0.05;
    var clockBigDt = clockDt * 5;
    var mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
    var compute_upto_secs = mainClock.t1;
    var advanceDt = 0.0;
    var adaptFrameInterval = (function () {
        var runningFrameInterval = 1/60;
        var lastTickTime_secs = mainClock.t1;
        var frUpdateInterval = 15;
        var frUpdateCounter = frUpdateInterval;
        return function (t) {
            var frameDt = t - lastTickTime_secs;
            if (frameDt > 0.01 && frameDt < 0.07) {
                runningFrameInterval += 0.05 * (frameDt - runningFrameInterval);
                kFrameAdvance = kFrameInterval = runningFrameInterval;
                clockDt = 3.33 * kFrameInterval;
                clockBigDt = clockDt * 5;
                if (frUpdateCounter-- <= 0) {
                    self.frame_rate.value = Math.round(1/kFrameInterval);
                    frUpdateCounter = frUpdateInterval;
                }
            }
            lastTickTime_secs = t;
        };
    }());
    function scheduleTick() {
        var i, N, t, length, f, a, once = true;
        t = time_secs();
        adaptFrameInterval(t);
        compute_upto_secs = t + clockDt;
        while (t - mainClock.t1 > clockBigDt) {
            advanceDt = t - mainClock.t1;
            mainClock.advance(advanceDt);
        }
        while (once || mainClock.t1 < compute_upto_secs) {
            if (uqueue.length > 0) {
                length = uqueue.length;
                for (i = 0; i < length; ++i) {
                    uqueue.remove()();
                }
            }
            length = queue.length;
            for (i = 0; i < length; ++i) {
                queue.remove()(self, mainClock, cont);
            }
            if (mainClock.t1 < compute_upto_secs) {
                mainClock.tick();
            }
            advanceDt = 0.0;
            once = false;
        }
        if (fqueue.length > 0) {
            length = fqueue.length;
            for (i = 0; i < length; i += 2) {
                f = fqueue.remove();
                a = fqueue.remove();
                f(t, a);
            }
        }
        if (self.ontick) {
            self.ontick(t);
        }
    }
    function schedule(model) {
        if (model) {
            queue.add(model);
        }
    }
    function scheduleFrame(f, info) {
        if (f) {
            fqueue.add(f);
            fqueue.add(info);
        }
    }
    function scheduleUpdate(f) {
        if (f) {
            uqueue.add(f);
        }
    }
    function perform(model, clock, next) {
        model(self, clock, next);
    }
    function playNow(model) {
        model(self, mainClock.copy(), stop);
    }
    var play = (function () {
        if (audioContext) {
            return function waitForAudioClockStartAndPlay(model) {
                if (audioContext.currentTime === 0) {
                    setTimeout(waitForAudioClockStartAndPlay, 100, model);
                } else {
                    mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
                    compute_upto_secs = mainClock.t1;
                    self.play = play = playNow;
                    playNow(model);
                }
            };
        } else {
            return playNow;
        }
    }());
    function stop(sched, clock, next) {
    }
    function cont(sched, clock, next) {
        if (next) {
            next(sched, clock, stop);
        }
    }
    function delay(dt, callback) {
        return function (sched, clock, next) {
            var startTime = clock.t1r;
            function tick(sched, clock) {
                var endTime = startTime + dt.valueOf();
                if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                    clock.advance(advanceDt);
                }
                if (clock.t1 > compute_upto_secs) {
                    schedule(poll);
                    return;
                }
                if (clock.t2r < endTime) {
                    if (callback) {
                        callback(clock, clock.t1r, clock.t2r, startTime, endTime);
                    }
                    clock.tick();
                    schedule(poll);
                } else {
                    if (callback && endTime >= clock.t1r) {
                        callback(clock, clock.t1r, endTime, startTime, endTime);
                    }
                    if (clock.t2r > clock.t1r) {
                        next(sched, clock.nudgeToRel(endTime), stop);
                    } else {
                        next(sched, clock, stop);
                    }
                }
            }
            function poll(sched) {
                tick(sched, clock, stop);
            }
            tick(sched, clock);
        };
    }
    function seq(model1, model2) {
        return function (sched, clock, next) {
            model1(sched, clock, seq(model2, next));
        };
    }
    function loop(model) {
        return function looper(sched, clock, next) {
            model(sched, clock, looper);
        };
    }
    function loop_while(flag, model) {
        return function (sched, clock, next) {
            function loopWhileFlag() {
                if (flag.valueOf()) {
                    model(sched, clock, loopWhileFlag);
                } else {
                    next(sched, clock, stop);
                }
            }
            loopWhileFlag();
        };
    }
    function repeat(n, model) {
        return function (sched, clock, next) {
            var counter = 0;
            function repeatNTimes() {
                if (counter < n) {
                    counter++;
                    model(sched, clock, repeatNTimes);
                } else {
                    next(sched, clock, stop);
                }
            }
            repeatNTimes();
        };
    }
    function fork(models) {
        if (models && models.constructor === Function) {
            models = Array.prototype.slice.call(arguments, 0);
        } else {
            models = models.slice(0);
        }
        return function (sched, clock, next) {
            var syncCount = 0;
            function join(sched, clockJ) {
                syncCount++;
                if (syncCount === models.length) {
                    next(sched, clock.syncWith(clockJ), stop);
                }
            }
            models.forEach(function (model) {
                model(sched, clock.copy(), join);
            });
        };
    }
    function spawn(models) {
        if (models && models.constructor === Function) {
            models = Array.prototype.slice.call(arguments, 0);
        } else {
            models = models.slice(0);
        }
        return function (sched, clock, next) {
            models.forEach(function (model) {
                model(sched, clock.copy(), stop);
            });
            next(sched, clock, stop);
        };
    }
    function dynamic(dyn) {
        return function (sched, clock, next) {
            dyn(clock)(sched, clock, next);
        };
    }
    function track(models) {
        if (models && models.constructor === Function) {
            models = Array.prototype.slice.call(arguments, 0);
        }
        function track_iter(sched, clock, next, startIndex, endIndex) {
            var i = 0, i_end = models.length;
            if (arguments.length > 3) {
                ;
                i = startIndex;
                i_end = endIndex;
            }
            function iter(sched, clock, _) {
                if (i < i_end) {
                    models[i++](sched, clock, iter);
                } else {
                    next(sched, clock, stop);
                }
            }
            iter(sched, clock, next);
        }
        track_iter.minIndex = 0;
        track_iter.maxIndex = models.length;
        track_iter.models = models;
        return track_iter;
    }
    function slice(aTrack, startIndex, endIndex) {
        endIndex = (arguments.length > 2 ? endIndex : aTrack.maxIndex);
        startIndex = (arguments.length > 1 ? Math.max(aTrack.minIndex, Math.min(startIndex, endIndex)) : aTrack.minIndex);
        return function (sched, clock, next) {
            aTrack(sched, clock, next, startIndex, endIndex);
        };
    }
    var fire;
    if (options && options.diagnostics) {
        do { if (4 <= LOG_LEVEL) { console.log("scheduler.js" + '[' + 631 + ']:\t', "fire: diagnostics on"); } } while (false);
        fire = function (callback) {
            return function (sched, clock, next) {
                var t = time_secs();
                ;
                callback(clock);
                next(sched, clock, stop);
            };
        };
    } else {
        fire = function (callback) {
            return function (sched, clock, next) {
                callback(clock);
                next(sched, clock, stop);
            };
        };
    }
    function display(callback) {
        return function (sched, clock, next) {
            var t1 = clock.t1;
            function show(t) {
                if (t + kFrameAdvance > t1) {
                    callback(clock, t1, t);
                } else {
                    scheduleFrame(show);
                }
            }
            scheduleFrame(show);
            next(sched, clock, stop);
        };
    }
    function frame(callback) {
        return function (sched, clock, next) {
            var t1 = clock.t1;
            function show(t) {
                if (t + kFrameAdvance > t1) {
                    clock.jumpTo(t);
                    callback(clock);
                    next(sched, clock, stop);
                } else {
                    scheduleFrame(show);
                }
            }
            scheduleFrame(show);
        };
    }
    function frames(dt, callback) {
        return function (sched, clock, next) {
            var startTime = clock.t1r;
            var animTime = startTime;
            var animTimeAbs = clock.t1;
            var animTick, animInfo;
            if (callback) {
                animTick = function (t, info) {
                    if (info.intervals.length > 0) {
                        var t1 = info.intervals[0], t1r = info.intervals[1], t2r = info.intervals[2], r = info.intervals[3];
                        if (t1r <= info.endTime) {
                            if (t1 < kFrameAdvance + t) {
                                callback(info.clock, t1r, t2r, info.startTime, info.endTime, r);
                                info.intervals.splice(0, 4);
                            }
                            scheduleFrame(animTick, info);
                            return;
                        } else {
                        }
                    }
                    if (!info.end) {
                        scheduleFrame(animTick, info);
                    }
                };
                animInfo = {clock: clock, intervals: [], startTime: clock.t1r, endTime: clock.t1r + dt.valueOf(), end: false};
                scheduleFrame(animTick, animInfo);
            }
            function tick(sched, clock) {
                var i, N, dtr, step;
                var endTime = startTime + dt.valueOf();
                if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                    clock.advance(advanceDt);
                    if (animInfo) {
                        animTimeAbs += step;
                        if (animInfo.intervals.length > 4) {
                            animInfo.intervals.splice(0, animInfo.intervals.length - 4);
                        }
                        if (animInfo.intervals.length > 0) {
                            animInfo.intervals[0] += step;
                            animInfo.intervals[3] = clock.rate.valueOf();
                        }
                    }
                }
                if (clock.t1 > compute_upto_secs) {
                    schedule(poll);
                    return;
                }
                if (animInfo && clock.t1r <= endTime) {
                    animInfo.endTime = endTime;
                    var frozenRate = clock.rate.valueOf();
                    dtr = Math.max(0.001, kFrameInterval * frozenRate);
                    while (animTime < clock.t2r) {
                        animInfo.intervals.push(animTimeAbs);
                        animInfo.intervals.push(animTime);
                        animInfo.intervals.push(animTime + dtr);
                        animInfo.intervals.push(frozenRate);
                        animTime += dtr;
                    }
                }
                if (clock.t2r < endTime) {
                    clock.tick();
                    schedule(poll);
                } else {
                    if (animInfo) {
                        animInfo.end = true;
                    }
                    if (clock.t2r > clock.t1r) {
                        next(sched, clock.nudgeToRel(endTime), stop);
                    } else {
                        next(sched, clock, stop);
                    }
                }
            }
            function poll(sched) {
                tick(sched, clock, stop);
            }
            tick(sched, clock);
        };
    }
    function log(msg) {
        return fire(function () {
            console.log(msg);
        });
    }
    function anim(param, dur) {
        var v1, v2, func, afunc;
        switch (arguments.length) {
            case 3:
                afunc = arguments[2];
                break;
            case 4:
                v1 = arguments[2];
                v2 = arguments[3];
                afunc = function (f) {
                    return (1 - f ) * v1.valueOf() + f * v2.valueOf();
                };
                break;
            case 5:
                v1 = arguments[2];
                v2 = arguments[3];
                func = arguments[4];
                afunc = function (frac) {
                    var f = func(frac);
                    return (1 - f) * v1.valueOf() + f * v2.valueOf();
                };
                break;
            default:
                throw new Error("Invalid arguments to anim()");
        }
        if (param.constructor.name === 'AudioGain' || param.constructor.name === 'AudioParam') {
            return delay(dur, function (clock, t1, t2, startTime, endTime) {
                var dt = endTime - startTime;
                var t1f, t2f;
                if (t1 <= startTime) {
                    t1f = dt > instant_secs ? (t1 - startTime) / dt : 0;
                    param.setValueAtTime(afunc(t1f), clock.rel2abs(t1));
                }
                t2f = dt > instant_secs ? (t2 - startTime) / dt : 1;
                param.linearRampToValueAtTime(afunc(t2f), clock.rel2abs(t2));
            });
        } else {
            return delay(dur, function (clock, t1, t2, startTime, endTime) {
                var dt = endTime - startTime - (t2 - t1);
                if (dt > instant_secs) {
                    param.value = afunc((t1 - startTime) / dt);
                } else {
                    param.value = afunc(1);
                }
            });
        }
    }
    function rate(r) {
        return function (sched, clock, next) {
            clock.rate = r;
            next(sched, clock, stop);
        };
    }
    function choice(models) {
        return dynamic(function () {
            return models[Math.floor(Math.random() * models.length)];
        });
    }
    function sync(N) {
        if (arguments.length > 0) {
            return (function (i, N, syncs) {
                for (; i < N; ++i) {
                    syncs.push(sync());
                }
                return syncs;
            }(0, N, []));
        }
        var models = [];
        function syncModel(sched, clock, next) {
            var i, N, actions;
            if (models.length > 0) {
                actions = models;
                models = [];
                for (i = 0, N = actions.length; i < N; ++i) {
                    actions[i](sched, clock.copy(), stop);
                }
            }
            next(sched, clock, stop);
        }
        syncModel.play = function (model) {
            models.push(model);
            return this;
        };
        syncModel.cancel = function () {
            models.splice(0, models.length);
            return this;
        };
        return syncModel;
    }
    function gate(N) {
        if (arguments.length > 0) {
            return (function (i, N, gates) {
                for (; i < N; ++i) {
                    gates.push(gate());
                }
                return gates;
            }(0, N, []));
        }
        var cache = [];
        var state_stack = [];
        var isOpen = true;
        function gateModel(sched, clock, next) {
            if (isOpen) {
                next(sched, clock, stop);
            } else {
                cache.push({sched: sched, next: next, clock: clock});
            }
        }
        function release(clock) {
            var actions = cache;
            var i, N, a, t = time_secs();
            cache = [];
            for (i = 0, N = actions.length; i < N; ++i) {
                a = actions[i];
                a.next(a.sched, clock ? clock.copy() : a.clock.advanceTo(t), stop);
            }
        }
        gateModel.__defineGetter__('isOpen', function () { return isOpen; });
        gateModel.__defineSetter__('isOpen', function (v) {
            if (v) {
                gateModel.open();
            } else {
                gateModel.close();
            }
            return v;
        });
        gateModel.open = function (sched, clock, next) {
            isOpen = true;
            release(clock);
            if (next) {
                next(sched, clock, stop);
            }
        };
        gateModel.close = function (sched, clock, next) {
            isOpen = false;
            if (next) {
                next(sched, clock, stop);
            }
        };
        gateModel.toggle = function (sched, clock, next) {
            if (isOpen) {
                return gateModel.close(sched, clock, next);
            } else {
                return gateModel.open(sched, clock, next);
            }
        };
        gateModel.cancel = function (sched, clock, next) {
            cache.splice(0, cache.length);
            if (next) {
                next(sched, clock, stop);
            }
        };
        gateModel.push = function (sched, clock, next) {
            state_stack.push({isOpen: isOpen, cache: cache});
            cache = [];
            if (next) {
                next(sched, clock, stop);
            }
        };
        gateModel.pop = function (sched, clock, next) {
            var state = state_stack.pop();
            cache.push.apply(cache, state.cache);
            this.isOpen = state.isOpen;
            if (next) {
                next(sched, clock, stop);
            }
        };
        return gateModel;
    }
    function stats() {
        return {
            frame_jitter_ms: 0
        };
    }
    self.audioContext = audioContext;
    self.update = scheduleUpdate;
    self.perform = perform;
    self.cancel = cancel;
    self.play = play;
    self.stop = stop;
    self.cont = cont;
    self.delay = delay;
    self.loop = loop;
    self.loop_while = loop_while;
    self.repeat = repeat;
    self.fork = fork;
    self.spawn = spawn;
    self.dynamic = dynamic;
    self.track = track;
    self.slice = slice;
    self.fire = fire;
    self.display = display;
    self.frame = frame;
    self.frames = frames;
    self.log = log;
    self.anim = anim;
    self.rate = rate;
    self.choice = choice;
    self.sync = sync;
    self.gate = gate;
    self.stats = stats;
    self.running = (options && ('running' in options) && options.running) || true;
    if (org.anclab.steller.Models) {
        self.models = org.anclab.steller.Models(self);
    }
    return self;
}
var UI = (function (UI) {
    function round(n) {
        var m = n % 1;
        var f = n - m;
        var k = Math.pow(10, 4 - Math.min(3, ('' + f).length));
        return Math.round(n * k) / k;
    }
    function mappingFn(mapping) {
        if (typeof(mapping) === 'string') {
            return Param.mappings[mapping];
        } else {
            return mapping || Param.mappings.linear;
        }
    }
    function insertBeforeEnd(target) {
        return function (e) {
            target.insertAdjacentElement('beforeend', e);
        };
    }
    UI.basicUI = function (document, model, sectionLabel) {
        if (model.ui) {
            return model.ui;
        }
        var div = document.createElement('div');
        if (sectionLabel) {
            div.insertAdjacentHTML('beforeend', '<p><b>' + sectionLabel + '</b></p>');
        }
        var specs = Param.names(model).map(function (k) {
            var spec = Object.create(model[k].spec);
            spec.name = spec.name || k;
            spec.param = model[k];
            return spec;
        });
        specs.forEach(function (spec) {
            var paramName = spec.name;
            var param = spec.param;
            if ('min' in spec && 'max' in spec) {
                var cont = document.createElement('div');
                var label = document.createElement('span');
                var valueDisp = document.createElement('span');
                label.innerText = (spec.label || paramName) + ': ';
                label.style.width = '100px';
                label.style.display = 'inline-block';
                label.style.textAlign = 'left';
                var slider = document.createElement('input');
                slider.type = 'range';
                slider.min = 0.0;
                slider.max = 1.0;
                slider.step = 0.001;
                var mapping = mappingFn(spec.mapping);
                var units = spec.units ? ' ' + spec.units : '';
                slider.value = mapping.toNorm(param);
                valueDisp.innerText = ' (' + round(param.value) + units + ')';
                        slider.changeModelParameter = function (e) {
                            param.value = mapping.fromNorm(param, parseFloat(this.value));
                        };
                        slider.changeSliderValue = function (value) {
                            slider.value = mapping.toNorm(param);
                            valueDisp.innerText = ' (' + round(value) + units + ')';
                                };
                                slider.addEventListener('change', slider.changeModelParameter);
                                param.watch(slider.changeSliderValue);
                                [label, slider, valueDisp].forEach(insertBeforeEnd(cont));
                                div.insertAdjacentElement('beforeend', cont);
                                }
                                });
                            return model.ui = div;
    };
    return UI;
}({}));
var dummyObject = {params: true, length: 1};
function validName(name) {
    if (dummyObject[name]) {
        throw new Error("Invalid param name [" + name + "]");
    }
    return name;
}
var Util = {};
Util.p2f = function (pitch) {
    return 440 * Math.pow(2, (pitch.valueOf() - 69) / 12);
};
Util.f2p = function (f) {
    var p = 69 + 12 * Math.log(f.valueOf() / 440) / Math.LN2;
    return Math.round(p * 100) / 100;
};
Util.augment = function (submodName, fn) {
    var steller = org.anclab.steller;
    if (submodName in steller) {
        steller[submodName].augmentors.push(fn);
    } else {
        function newMod() {
            var argv = Array.prototype.slice.call(arguments, 0);
            var obj = {};
            newMod.augmentors.forEach(function (f) {
                obj = f.apply(obj, argv) || obj;
            });
            return obj;
        }
        newMod.augmentors = [fn];
        steller[submodName] = newMod;
    }
    return steller[submodName];
};
function detectBrowserEnv() {
    return typeof(window) === 'object' && typeof(document) === 'object' && window.document === document;
}
function getRequestAnimationFrameFunc() {
    try {
        return (window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                (function (cb) {
                    setTimeout(cb, 1000/60);
                }));
    } catch (e) {
        return undefined;
    }
}
function getAudioContext() {
;(function () {
    var GLOBAL = this;
    function alias(obj, oldName, newName) {
        obj[newName] = obj[newName] || obj[oldName];
        supportDeprecated(obj, oldName, newName);
    }
    function supportDeprecated(obj, oldName, newName) {
        var oldMethod = obj[oldName];
        obj[oldName] = function () {
            console.warn('Web Audio API: Deprecated name %s used. Use %s instead.', oldName, newName);
            obj[oldName] = oldMethod || obj[newName];
            return oldMethod.apply(this, arguments);
        };
    }
    GLOBAL.AudioContext = (function (AC) {
        'use strict';
        if (!AC) {
            console.warn('Web Audio API not supported on this client.');
            return undefined;
        }
        return function AudioContext() {
            var ac, AudioParam, AudioParamOld, BufferSource, Oscillator;
            if (arguments.length === 0) {
                ac = new AC;
            } else if (arguments.length === 3) {
                ac = new AC(arguments[0], arguments[1], arguments[2]);
            } else {
                throw new Error('Invalid instantiation of AudioContext');
            }
            alias(ac, 'createGainNode', 'createGain');
            alias(ac, 'createDelayNode', 'createDelay');
            alias(ac, 'createJavaScriptNode', 'createScriptProcessor');
            alias(ac, 'createWaveTable', 'createPeriodicWave');
            AudioParam = Object.getPrototypeOf(ac.createGain().gain);
            AudioParamOld = Object.getPrototypeOf(AudioParam);
            if (AudioParamOld.setValueAtTime) {
                console.warn('Implementation uses extra dummy interface for AudioGainParam. This will be removed.');
                AudioParam = AudioParamOld;
            }
            alias(AudioParam, 'setTargetValueAtTime', 'setTargetAtTime');
            BufferSource = Object.getPrototypeOf(ac.createBufferSource());
            alias(BufferSource, 'noteOff', 'stop');
            if (BufferSource.start) {
                supportDeprecated(BufferSource, 'noteOn', 'start');
                supportDeprecated(BufferSource, 'noteGrainOn', 'start');
            } else {
                console.warn('Web Audio API: Only BufferSource.note[Grain]On available. Providing BufferSource.start.');
                BufferSource.start = function start(when, offset, duration) {
                    switch (arguments.length) {
                        case 1: return this.noteOn(when);
                        case 3: return this.noteGrainOn(when, offset, duration);
                        default: throw new Error('Invalid arguments to BufferSource.start');
                    }
                };
                supportDeprecated(BufferSource, 'noteOn', 'start');
                supportDeprecated(BufferSource, 'noteOff', 'stop');
            }
            Oscillator = Object.getPrototypeOf(ac.createOscillator());
            alias(Oscillator, 'noteOn', 'start');
            alias(Oscillator, 'noteOff', 'stop');
            alias(Oscillator, 'setWaveTable', 'setPeriodicWave');
            return ac;
        };
    }(GLOBAL.AudioContext || GLOBAL.webkitAudioContext));
    GLOBAL.webkitAudioContext = function AudioContext() {
        console.warn('Use "new AudioContext" instead of "new webkitAudioContext".');
        switch (arguments.length) {
            case 0: return new GLOBAL.AudioContext();
            case 3: return new GLOBAL.AudioContext(arguments[0], arguments[1], arguments[2]);
            default: throw new Error('Invalid AudioContext creation');
        }
    };
}());
    return AudioContext;
}
function getHighResPerfTimeFunc() {
    try {
        var perf = window.performance;
        var perfNow = (perf && (perf.now || perf.webkitNow || perf.mozNow));
        if (perfNow) {
            return function () {
                return perfNow.call(perf) * 0.001;
            };
        }
    } catch (e) {
    }
    return function () {
        return Date.now() * 0.001;
    };
}
    function SoundModel(obj, inputs, outputs) {
        var node = Eventable(GraphNode(obj, inputs, outputs));
        Eventable.observe(node, 'connect');
        Eventable.observe(node, 'disconnect');
        return node;
    }
    steller.Eventable = Eventable;
    steller.AsyncEventable = AsyncEventable;
    steller.GraphNode = GraphNode;
    steller.SoundModel = SoundModel;
    steller.Param = Param;
    steller.Scheduler = Scheduler;
    steller.Clock = Clock;
    steller.PeriodicTimer = PeriodicTimer;
    steller.JSNodeTimer = JSNodeTimer;
    steller.UI = UI;
    steller.Util = Util;
    steller.requestAnimationFrame = (function (raf) {
        return function (func) {
            return raf(func);
        };
    }(getRequestAnimationFrameFunc()));
    steller.AudioContext = getAudioContext();
}((function () { return typeof(window) === 'undefined' ? undefined : window; }()), org.anclab.steller));
;
org.anclab.steller.Util.augment('Models',
function (sh) {
    var steller = org.anclab.steller;
    var util = org.anclab.steller.Util;
    var SoundModel = steller.SoundModel;
    var GraphNode = steller.GraphNode;
    var Param = steller.Param;
    var AC = sh.audioContext;
    var models = this;
models.chime = function () {
    var output = AC.createGainNode();
    var model = SoundModel({}, [], [output]);
    model.halfLife = Param({min: 0.001, max: 10, value: 0.5, mapping: 'log'});
    model.attackTime = Param({min: 0.001, max: 1.0, value: 0.01, mapping: 'log'});
    model.level = Param({min: 0.125, max: 4.0, audioParam: output.gain, mapping: 'log'});
    model.play = function (pitchNumber, velocity) {
        if (velocity === undefined) {
            velocity = 1.0;
        }
        return sh.fire(function (clock) {
            var f = util.p2f(pitchNumber.valueOf());
            var osc = AC.createOscillator();
            osc.type = osc.SINE;
            osc.frequency.value = f;
            var gain = AC.createGainNode();
            gain.gain.value = 0;
            gain.gain.setValueAtTime(0, clock.t1);
            gain.gain.linearRampToValueAtTime(velocity.valueOf() / 8, clock.t1 + model.attackTime.value);
            var halfLife = model.halfLife.value * 440 / f;
            var dur = halfLife * 10;
            gain.gain.setTargetAtTime(0, clock.t1 + model.attackTime.value, halfLife);
            osc.connect(gain);
            gain.connect(output);
            osc.start(clock.t1);
            osc.stop(clock.t1 + dur);
        });
    };
    return model;
};
models.dc = (function () {
    var i, N, data, dcBuffer;
    N = 1024;
    dcBuffer = AC.createBuffer(1, N, AC.sampleRate);
    data = dcBuffer.getChannelData(0);
    for (i = 0; i < N; ++i) {
        data[i] = 1.0;
    }
    return function (value) {
        var dc = AC.createBufferSource();
        dc.buffer = dcBuffer;
        dc.loop = true;
        dc.start(0);
        var gain = AC.createGainNode();
        gain.gain.value = value;
        dc.connect(gain);
        var model = SoundModel({}, [], [gain]);
        model.level = Param({min: -1.0, max: 1.0, audioParam: gain.gain});
        model.stop = function (t) {
            dc.stop(t);
        };
        return model;
    };
}());
models.noise = (function () {
    var noiseBuffer = AC.createBuffer(1, 5 * AC.sampleRate, AC.sampleRate);
    var i, N, data = noiseBuffer.getChannelData(0);
    for (i = 0, N = data.length; i < N; ++i) {
        data[i] = 2 * Math.random() - 1;
    }
    return function () {
        var source = AC.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.gain.value = 1.0;
        var gain = AC.createGainNode();
        gain.gain.value = 1.0;
        source.connect(gain);
        source.start(0);
        var dc = models.dc(0);
        dc.connect(gain);
        var model = SoundModel({}, [], [gain]);
        model.spread = Param({min: 0.01, max: 10.0, audioParam: source.gain, mapping: 'log'});
        model.mean = dc.level;
        return model;
    };
}());
models.probe = function () {
    var mean = Param({min: -1, max: 1, value: 0});
    var sigma = Param({min: -1, max: 1, value: 1});
    var energy = Param({min: 0, max: 1, value: 0});
    var js = AC.createScriptProcessor(512, 1, 1);
    var sum = 0, sumSq = 0, k = 1 - Math.exp(Math.log(0.5) / 1024);
    js.onaudioprocess = function (e) {
        var b = e.inputBuffer.getChannelData(0);
        var N = b.length, i = 0, v = 0;
        for (i = 0; i < N; ++i) {
            v = b[i];
            sum += k * (v - sum);
            sumSq += k * (v * v - sumSq);
        }
        mean.value = sum;
        energy.value = sumSq;
        sigma.value = Math.sqrt(Math.max(0, sumSq - sum * sum));
    };
    js.connect(AC.destination);
    var model = SoundModel({}, [js], []);
    model.mean = mean;
    model.sigma = sigma;
    model.energy = energy;
    return model;
};
models.mic = (function () {
    function getUserMedia(dictionary, callback, errback) {
        try {
            navigator.webkitGetUserMedia(dictionary, callback, errback);
        } catch (e) {
            errback(e);
        }
    }
    function setupMic(micModel, stream) {
        if (!micSource) {
            ;
            micSource = AC.createMediaStreamSource(stream);
        }
        micSource.connect(micModel.outputs[0]);
        micModel.error = null;
        micModel.ready.value = 1;
    }
    var micSource;
    return function () {
        var micOut = AC.createGainNode();
        var micModel = SoundModel({}, [], [micOut]);
        micModel.ready = Param({min: -1, max: 1, value: 0});
        micModel.gain = Param({min: 0, max: 1, audioParam: micOut.gain});
        if (micSource) {
            setupMic(micModel, null);
        } else {
            getUserMedia({audio: true},
                    function (stream) {
                        return setupMic(micModel, stream);
                    },
                    function (e) {
                        micModel.error = e;
                        micModel.gain.value = 0;
                        micModel.ready.value = -1;
                    });
        }
        return micModel;
    };
}());
models.spectrum = function (N, smoothingFactor) {
    N = N || 1024;
    var analyser = AC.createAnalyser();
    analyser.fftSize = N * 2;
    analyser.frequencyBinCount = N;
    analyser.smoothingTimeConstant = arguments.length < 2 ? 0.1 : smoothingFactor;
    var model = SoundModel({}, [analyser], []);
    model.bins = new Float32Array(N);
    model.freqs = new Float32Array(N);
    model.time = Param({min: 0, max: 1e9, value: 0});
    for (var i = 0; i < N; ++i) {
        model.freqs[i] = i * AC.sampleRate / analyser.fftSize;
    }
    var grabRequest;
    function update() {
        if (grabRequest) {
            var ts = AC.currentTime;
            analyser.getFloatFrequencyData(model.bins);
            for (var i = 0, bins = model.bins, N = bins.length; i < N; ++i) {
                bins[i] = Math.pow(10, bins[i] / 20);
            }
            grabRequest = steller.requestAnimationFrame(update);
            model.time.value = ts;
        }
    }
    model.start = sh.fire(function () {
        if (!grabRequest) {
            grabRequest = steller.requestAnimationFrame(update);
        }
    });
    model.stop = sh.fire(function () {
        grabRequest = undefined;
    });
    return model;
};
(function () {
    var sampleCache = {};
    function sampleKey(url) { return 'sound:' + url; }
    models.load_sample = function (url, callback, errback) {
        var key = sampleKey(url);
        var buff = sampleCache[key];
        if (buff) {
            if (callback) {
                callback(buff);
            }
            return buff;
        } else if (callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onerror = function (e) {
                ;
                if (errback) {
                    errback(e, url);
                }
            };
            xhr.onload = function () {
                AC.decodeAudioData(xhr.response,
                        function (buff) {
                            callback(sampleCache[key] = buff);
                            do { if (0 <= LOG_LEVEL) { console.log("models/sample.js" + '[' + 31 + ']:\t', "Sound [" + url + "] loaded!"); } } while (false);
                        },
                        function (err) {
                            ;
                            if (errback) {
                                errback(err, url);
                            }
                        });
            };
            xhr.send();
        }
        return undefined;
    };
    models.load_sample.clearCache = function () {
        sampleCache = {};
    };
    models.sample = function (url, errback) {
        var level = AC.createGainNode();
        level.gain.value = 0.25;
        var model = SoundModel({}, [], [level]);
        model.level = Param({min: 0.001, max: 10, audioParam: level.gain, mapping: 'log'});
        model.attackTime = Param({min: 0.001, max: 10.0, value: 0.02, mapping: 'log'});
        model.releaseTime = Param({min: 0.001, max: 10.0, value: 0.1, mapping: 'log'});
        var soundBuff;
        model.load = function (sched, clock, next) {
            if (soundBuff) {
                sched.perform(next, clock, sched.stop);
            } else {
                var dt = clock.t1 - AC.currentTime;
                models.load_sample(
                        url,
                        function (buff) {
                            soundBuff = buff;
                            model.duration = soundBuff.duration;
                            sched.perform(next, clock.jumpTo(AC.currentTime + dt), sched.stop);
                        },
                        errback
                        );
            }
        };
        function trigger(clock, rate, velocity, sampleOffset, sampleDuration) {
            ;
            var source = AC.createBufferSource();
            source.buffer = soundBuff;
            source.connect(level);
            source.playbackRate.value = rate;
            source.gain.setValueAtTime(0, clock.t1);
            source.gain.setTargetAtTime(velocity, clock.t1, model.attackTime.value / 3);
            if (arguments.length > 3) {
                source.noteGrainOn(clock.t1, sampleOffset, (arguments.length > 4 ? sampleDuration : source.duration));
            } else {
                source.noteOn(clock.t1);
            }
            return source;
        }
        model.trigger = function (velocity, detune_semitones) {
            detune_semitones = detune_semitones || 0.0;
            return sh.fire(function (clock) {
                var rate = Math.pow(2, detune_semitones.valueOf() / 12);
                trigger(clock, rate, velocity.valueOf());
            });
        };
        model.play = sh.track([
                model.load,
                sh.dynamic(function (clock) {
                    var source = trigger(clock, clock.rate.valueOf(), 1.0);
                    return sh.delay(model.duration, function (clock) {
                        source.playbackRate.value = clock.rate.valueOf();
                    });
                })
                ]);
        model.note = function (pitch, startOffset, duration, activeDur) {
            if (arguments.length < 4) {
                activeDur = duration;
            }
            return sh.dynamic(function (clock) {
                var source = trigger(clock, pitch.valueOf(), 1.0, startOffset, duration);
                source.gain.value = 0;
                source.gain.setTargetAtTime(1.0, clock.t1, model.attackTime.value / 3);
                source.playbackRate.setTargetAtTime(pitch.valueOf(), clock.t1, clock.dt/3);
                return sh.track([
                    sh.spawn(sh.track([
                            sh.delay(activeDur),
                            sh.fire(function (clock) {
                                source.gain.setTargetAtTime(0.0, clock.t1, model.releaseTime.value / 3);
                                source.stop(clock.t1 + 12 * model.releaseTime.value);
                            })
                            ])),
                    sh.delay(duration, function (clock) {
                        source.playbackRate.exponentialRampToValueAtTime(pitch.valueOf(), clock.t1);
                    })
                    ]);
            });
        };
        return model;
    };
    models.sample.clearCache = models.load_sample.clearCache;
}());
models.jsnode = function (spec) {
    var numParams = spec.audioParams ? spec.audioParams.length : 0;
    var numberOfInputs = spec.numberOfInputs || 0;
    var numberOfOutputs = spec.numberOfOutputs || 1;
    var numInputs = numberOfInputs + numParams;
    var numOutputs = numberOfOutputs;
    ;
    ;
    ;
    var merger = numInputs > 0 ? AC.createChannelMerger(numInputs) : undefined;
    var splitter = numOutputs > 0 ? AC.createChannelSplitter(numOutputs) : undefined;
    var inputNodes = [];
    var i, N, node;
    for (i = 0, N = numInputs; i < N; ++i) {
        node = AC.createGainNode();
        inputNodes.push(node);
        node.connect(merger, 0, i);
    }
    var outputNodes = [];
    for (i = 0, N = numOutputs; i < N; ++i) {
        node = AC.createGainNode();
        outputNodes.push(node);
        if (splitter) {
            splitter.connect(node, i);
        }
    }
    var paramNames;
    if (spec.audioParams) {
        paramNames = Object.keys(spec.audioParams);
        ;
        ;
        ;
    } else {
        paramNames = [];
    }
    var obj = {};
    var inputs = [], outputs = [];
    obj.inputs = inputs;
    obj.outputs = outputs;
    for (i = 0, N = paramNames.length; i < N; ++i) {
        obj[paramNames[i]] = null;
    }
    obj.playbackTime = AC.currentTime;
    var hasStarted = false, hasFinished = false, startTime = 0, stopTime = Infinity;
    var autoDestroy;
    var onaudioprocess = function (event) {
        var i, N, t, t1, t2, samplesOutput = 0;
        if (hasFinished) {
            return;
        }
        var bufferLength = event.outputBuffer.length;
        t = Math.floor(AC.currentTime * AC.sampleRate);
        t1 = Math.max(t, startTime);
        t2 = t + bufferLength;
        var dt1 = t1 - t;
        var dt2 = t2 - t;
        if (t2 > t1) {
            for (i = 0, N = numberOfInputs; i < N; ++i) {
                inputs[i] = event.inputBuffer.getChannelData(i).subarray(dt1, dt2);
            }
            for (i = 0, N = numOutputs; i < N; ++i) {
                outputs[i] = event.outputBuffer.getChannelData(i).subarray(dt1, dt2);
            }
            for (i = 0, N = paramNames.length; i < N; ++i) {
                obj[paramNames[i]] = event.inputBuffer.getChannelData(numberOfInputs + i).subarray(dt1, dt2);
            }
            obj.playbackTime = (event.playbackTime || AC.currentTime) + dt1 / AC.sampleRate;
            obj.samplesToStop = stopTime - t1;
            samplesOutput = spec.onaudioprocess.call(sm, obj);
            if (samplesOutput === undefined) {
                samplesOutput = t2 - t1;
            }
        }
        if (t1 + samplesOutput < t2) {
            do { if (1 <= LOG_LEVEL) { console.log("models/jsnode.js" + '[' + 168 + ']:\t', "Finished", t2, stopTime); } } while (false);
            hasFinished = true;
            setTimeout(autoDestroy, Math.round(bufferLength * 1000 / AC.sampleRate));
        }
    };
    var sm = SoundModel({}, inputNodes, outputNodes);
    var dc = paramNames.length > 0 ? models.dc(1) : undefined;
    paramNames.forEach(function (pn, i) {
        var node = inputNodes[numberOfInputs + i];
        sm[pn] = node.gain;
        node.gain.value = spec.audioParams[pn];
        dc.connect(node);
        ;
    });
    var kBufferLength = spec.bufferLength || 512;
    var jsn = sm.keep(AC.createScriptProcessor(kBufferLength, numInputs, Math.min(1, numOutputs)));
    merger && merger.connect(jsn);
    jsn.onaudioprocess = onaudioprocess;
    var jsnDestination = splitter || AC.destination;
    autoDestroy = function () {
        hasFinished = true;
        jsn.disconnect();
        splitter && splitter.disconnect();
        dc && (dc.stop(0), dc.disconnect());
        merger && merger.disconnect();
        sm.drop(jsn);
        sm.emit && sm.emit('finished');
    };
    var startTimer;
    sm.prepareAheadTime = 0.1;
    sm.start = function (t) {
        if (hasStarted || hasFinished) {
            return;
        }
        if (t) {
            var dt = (Math.max(t, AC.currentTime) - AC.currentTime);
            if (startTimer) {
                cancelTimeout(startTimer);
                startTimer = null;
            }
            var starter = function (t) {
                startTime = Math.floor(t * AC.sampleRate);
                hasStarted = true;
                startTimer = null;
                jsn.connect(jsnDestination);
            };
            if (dt <= sm.prepareAheadTime) {
                starter(t);
            } else {
                startTimer = setTimeout(starter, Math.round(1000 * (dt - sm.prepareAheadTime)), t);
            }
        } else {
            hasStarted = true;
            jsn.connect(jsnDestination);
        }
    };
    sm.stop = function (t) {
        if (hasFinished) {
            return;
        }
        stopTime = Math.max(startTime, Math.ceil(t * AC.sampleRate));
    };
    if (numberOfInputs > 0) {
        sm.start(0);
    }
    return sm;
};
    return models;
});
