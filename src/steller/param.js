//
// Param(spec)
//
// A "class" that reifies a model parameter as an independent object.
// You create a parameter like this -
//      model.paramName = Param({min: 0, max: 1, value: 0.5});
//      model.paramName = Param({min: 0, max: 1, audioParam: anAudioParam});
//      model.paramName = Param({min: 0, max: 1, getter: g, setter: s});
//      model.paramName = Param({options: ["one", "two", "three"], value: "one"});
//
// You can use Param.names(model) to get the exposed parameter names.
//
// You can get and set the value of a parameter like this -
//      model.paramName.value = 5;
//
// You can install a callback to be called when a parameter value changes -
//      model.paramName.watch(function (value, param) { ... });
//      model.paramName.unwatch(callback);
//      model.paramName.unwatch(); // Removes all callbacks.
//
define(function () {

    function Param(spec) {
        var self = Object.create(Param.prototype);
        self.spec = spec = processOptionsParam(Object.create(spec));
        self.getter = undefined;
        self.setter = undefined;
        self.valueOf = undefined;       // Support for valueOf() protocol.
        self.audioParam = undefined;
        self.watchers = [];             // Maintain a per-parameter list of watchers.
        self._value = undefined;

        // Initialization.
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

    // Take care of enumeration or "options" parameters.
    function processOptionsParam(spec) {
        if (spec.options) {
            var hash = {};
            spec.options.forEach(function (o, i) {
                hash['option:' + o] = i + 1;
            });

            // Set a limiting function that validates the
            // value being assigned to the parameter.
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

    // Use for "mapping:" field of spec. This is not used internally at all, but
    // intended for UI use.
    Param.mappings = {};

    // Condition: spec.max > spec.min
    Param.mappings.linear = {
        fromNorm: function (p, f) {
            return p.spec.min + f * (p.spec.max - p.spec.min);
        },
        toNorm: function (p) {
            return (p.value - p.spec.min) / (p.spec.max - p.spec.min);
        }
    };

    // Condition: spec.max > spec.min > 0
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

    // Returns the names of all the exposed parameters of obj.
    Param.names = function (obj) {
        return Object.keys(obj).filter(function (k) {
            return obj[k] instanceof Param;
        });
    };

    // Exposes parameters of obj1 through obj2 as well.
    // `listOfParamNames`, if given, should be an array
    // of only those parameters that must be exposed.
    Param.expose = function (obj1, obj2, listOfParamNames) {
        if (!listOfParamNames) {
            listOfParamNames = Param.names(obj1);
        }

        listOfParamNames.forEach(function (n) {
            WARNIF(n in obj2, "Overwriting parameter named [" + n + "] in Param.expose call.");
            obj2[n] = obj1[n];
        });

        return Param;
    };

    // Bind one parameter to another. p2 is expected to 
    // be a parameter. If p1 is a parameter, then bind sets
    // things up so that updating p1 will cause p2 to be updated
    // to the same value. If p1 is just a value, then bind() simply
    // assigns its value to p2 once.
    //
    // This is similar in functionality to param.bind(p2), except that
    // it also works when p1 is not a parameter and is, say, an
    // audioParam or a normal numeric value.
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

    // To get the value of a parameter p, use p.value
    Param.prototype.__defineGetter__('value', function () {
        return this.getter();
    });

    // To set the value of a parameter p, do 
    //      p.value = v;
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

    // Installs a callback that gets called whenever the parameter's
    // value changes. The callback is called like this -
    //      callback(value, paramObject);
    Param.prototype.watch = function (callback) {
        var i, N, watchers = this.watchers;

        /* Make sure the callback isn't already installed. */
        for (i = 0, N = watchers.length; i < N; ++i) {
            if (watchers[i] === callback) {
                return this;
            }
        }

        watchers.push(callback);
        return this;
    };

    // Removes the given callback, or if none given removes
    // all installed watchers.
    Param.prototype.unwatch = function (callback) {
        var watchers = this.watchers;

        if (arguments.length < 1 || !callback) {
            /* Remove all watchers. */
            watchers.splice(0, watchers.length);
            return this;
        }

        /* Remove the installed watcher. Note that we only need
         * to check for one watcher because watch() will never 
         * add duplicates. */
        for (var i = watchers.length - 1; i >= 0; --i) {
            if (watchers[i] === callback) {
                watchers.splice(i, 1);
                return this;
            }
        }

        return this;
    };

    // Can call to force an observer notification.
    Param.prototype.changed = function () {
        observeParam(this, this.getter());
        return this;
    };

    // Makes an "alias" parameter - i.e. a parameter that 
    // represents the same value, but has a different name.
    // The alias is constructed such that p.alias("m").alias("n")
    // is equivalent to p.alias("n") - i.e. the original
    // parameter is the one being aliased all the time.
    Param.prototype.alias = function (name, label) {
        ASSERT(name, "Param.alias call needs name as first argument.");
        // If name is not given, no point in calling alias().

        var self = this;

        // Inherit from the original.
        var p = Object.create(self);

        // Rename it.
        p.spec = Object.create(self.spec);
        p.spec.name = name;
        if (label) {
            p.spec.label = label;
        }

        // Bind core methods to the original.
        p.getter = function () { return self.getter(); };
        p.setter = function (val) { return self.setter(val); };
        p.alias = function (name, label) { return self.alias(name, label); };

        return p;
    };

    // Binds a parameter to the given element's value.
    // Whetever the element changes, the parameter will be updated
    // and whenever the parameter is assigned, the element will also
    // be updated.
    //
    // The "element" can be a DOM element such as a slider, or 
    // anything with a '.value' that needs to be updated with the
    // latest value of this parameter whenever it happens to change.
    // If it is a DOM element, the parameter is setup to update to
    // the value of the DOM element as well.
    //
    // If you pass a string for `elem`, it is taken to be a DOM
    // element identifier and will be used via querySelectorAll to
    // find which elements it refers to and bind to all of them.
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
                elem.removeEventListener('input', onchange);
                param.unwatch(updateElem);
            };

            elem.addEventListener('input', onchange);
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

    // Removes binding to element, where `elem` is the
    // same kind as for `.bind(elem)` above.
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

    return Param;
});
