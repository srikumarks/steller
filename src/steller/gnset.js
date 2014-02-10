define(['./eventable'], function (Eventable) {

    return function (steller) {

        // A graph node set helps keep track of a set of connected
        // GraphNode objects so that the network can be saved and
        // loaded across sessions. 
        //
        // nodeTypes can either be another GraphNodeSet instance from
        // which to inherit model constructor definitions, or is an
        // argument that can be passed to loadDefinitions() (see below).
        //
        // TODO: Optimize the saved node set to only those that
        // are active. Also when saving as a Model, do not save
        // any nodes that are not in the path between the given
        // input and output nodes. This includes nodes from which
        // connections come into the input nodes and nodes to 
        // which connections go from the output nodes.
        function GraphNodeSet(audioContext, nodeTypes) {
            this._nextID = 1;
            this._nodes = {destination: {node: audioContext.destination, setup: []}};
            this._audioContext = audioContext;
            this._constructors = {};
            audioContext.destination._gnset_id = "destination";
            if (nodeTypes) {
                if (nodeTypes instanceof GraphNodeSet) {
                    // Take a short cut when one GraphNodeSet is permitted
                    // to inherit definitions from another.
                    this._constructors = Object.create(nodeTypes._constructors);
                } else {
                    defineNodeTypes(this, nodeTypes);
                }
            }
            return this;
        }

        // See defineNodeTypes() below.
        GraphNodeSet.prototype.loadDefinitions = function (definitions) {
            defineNodeTypes(this, definitions);
        };

        // When building your node graph, always create nodes using the node
        // method of the graph node set you want the node to be a part of. The
        // inputs/outputs must also be created this way. Any args beyond the
        // typename argument are passed on to the constructor.
        GraphNodeSet.prototype.node = function (typename) {
            var self = this;
            var argv = Array.prototype.slice.call(arguments, 1);
            var cons = self._constructors[typename];
            var nodeObj = Object.create(cons.prototype);
            nodeObj.audioContext = this._audioContext;
            var node = cons.apply(nodeObj, argv) || nodeObj;
            node.constructor = cons;
            argv.unshift(typename);
            var setup = [{fn: 'node', args: argv}]; // The first setup specifies the gnset.node(..) call.
            if (!(node.on && node.off && node.emit)) {
                node = Eventable(node);
                Eventable.observe(node, 'connect');
                Eventable.observe(node, 'disconnect');
            }
            var id = self._nextID++;
            node._gnset = self;
            node._gnset_id = id;
            node._gnset_typename = typename;
            self._nodes[id] = {node: node, setup: setup};

            // Keep track of connect/disconnect calls so they can 
            // be run again during de-serialization.
            node.on('connect', function () {
                var args = Array.prototype.slice.call(arguments, 1);
                args[0] = args[0]._gnset_id;
                setup.push({fn: 'connect', args: args});
            });
            node.on('disconnect', function () {
                var args = Array.prototype.slice.call(arguments, 1);
                setup.push({fn: 'disconnect', args: args});
            });

            return node;
        };

        // You can optionally label nodes so that you can access
        // specific nodes after deserialization. The node must
        // already be a part of the graph node set.
        GraphNodeSet.prototype.label = function (label, node) {
            console.assert(node._gnset === this);
            if (this._nodes[label]) {
                console.warn('GraphNodeSet.label: Existing label "' + label + '" will be redefined.');
                this._nodes[label]._gnset = null;
                this._nodes[label]._gnset_id = null;
            }
            if (label !== node._gnset_id) {
                this._nodes[label] = this._nodes[node._gnset_id];
                delete this._nodes[node._gnset_id];
                this._nodes[label].setup.push(['label', label]);
                node._gnset_id = label;
            }
            return node;
        };

        // Get a named node. If the label doesn't exist, undefined
        // is returned.
        GraphNodeSet.prototype.get = function (label) {
            var info = this._nodes[label];
            return info && info.node;
        };

        // At any time you can serialize the graph by calling save() on the
        // node set object. The return value is not a string, but a JSON-able
        // object which you need to convert to a string by JSON.stringify().
        //
        // This is unoptimized since it serializes all nodes part of the set,
        // whereas only the nodes that are connected to the destination by
        // some path are relevant. I leave that as an exercise :)
        //
        // A second optimization is that the setup sequence can be reduced
        // depending on the existence of disconnect calls. I just keep them
        // in the same sequence for simplicity.
        GraphNodeSet.prototype.save = function () {
            var self = this;
            var json = {
                type: 'GraphNodeSet',
                nodes: Object.keys(self._nodes).map(function (id) {
                    return {
                        id: id,
                        setup: self._nodes[id].setup
                    };
                })
            };
            return json;
        };

        // Serializes the GraphNodeSet as a SoundModel, which can then be
        // loaded to instantiate a sound model instead of a graph node set.
        // To turn a graph node set into a SoundModel, you identify input pins
        // of component nodes that are to serve as inputs of the wrapped
        // model, output pins of component nodes that are to serve as outputs
        // of the wrapped model and the parameters of component models to expose
        // to the users of the wrapped model.
        //
        // name is a name that will be given to the sound model 
        // constructor when it is loaded into a graph node.
        //
        // inputs is an array of {node: theNode, pin: inputPinNumber}
        // outputs is an array of {node: theNode, pin: outputPinNumber}
        // params is an array of {name: paramName, node: nodeLabel, nameInNode: optionalNodeParamName} 
        // The current value of the parameters will be snapshotted into the
        // saved model.
        GraphNodeSet.prototype.saveAsModel = function (name, inputs, outputs, params) {
            // Perform some basic checks on the arguments.
            // Once we do this check here, it is basically guaranteed that
            // a subsequent load() call will succeed.
            checkInputsSpec(this, inputs);
            checkOutputsSpec(this, outputs);
            checkParamsSpec(this, params);

            var self = this;
            var json = this.save();

            function encodePin(pinSpec) {
                if (pinSpec.hasOwnProperty('pin')) {
                    return { node: pinSpec.node._gnset_id, pin: pinSpec.pin };
                } else {
                    return { node: pinSpec.node._gnset_id };
                }
            }

            function encodeParam(param) {
                return {
                    name: param.name,
                    node: param.node,
                    nameInNode: param.nameInNode || param.name,
                    value: self._nodes[param.node][param.nameInNode || param.name].valueOf()
                };
            }

            json.type = 'SoundModel';
            json.name = name;
            json.inputs = inputs.map(encodePin);
            json.outputs = outputs.map(encodePin);
            json.params = params.map(encodeParam);

            return json;
        };

        // De-serialize a node graph from a JSON structure as produced by save() above;
        // You can load a new node set from a JSON like this -
        //      var gnset = new GraphNodeSet(audioContext, json);
        // or you can intake a graph into an existing graph node set like this -
        //      gnset.load(json);
        //
        GraphNodeSet.prototype.load = function (json) {
            return loaders[json.type](this, json);
        };

        /////////////////////////
        // Helpers

        // When instantiating a graph node set, you need to first define
        // types of nodes by associating a name with their constructor
        // of the form `function (...) { .. return aSoundModel; }`
        // You can either do this by explicitly passing a constructor
        // function and an associated name, or by passing a serialized
        // model specification as generated using saveAsModel(). In the
        // latter case, only one argument is necessary.
        //
        // A constructor function is one that produces a steller.SoundModel
        // when called like - `new ConstructorFn(args...)`, where the
        // arguments are all JSON serializable values.
        //
        // Within the constructor function, "this.audioContext" gives
        // access to the audio context within which the instantiation is
        // happening. The "this" object is expected to be enhanced 
        // by mixing in SoundModel. For example, here is a constructor
        // for a simple sine model that exposes a live controllable "freq" 
        // parameter.
        //
        //  function sine(freq) {
        //      var osc = this.audioContext.createOscillator();
        //      this.freq = steller.Param({min: 44.0, max: 4400.0, mapping: 'log', audioParam: osc.frequency, value: freq});
        //      osc.start(0);
        //      osc.connect(this.audioContext.destination);
        //      return steller.SoundModel(this, [], [osc]);
        //  }
        //  
        //  If the constructor function has a name, you can omit the
        //  first argument and only pass the function in.
        //
        function defineNodeType(self, typename, spec) {
            if (arguments.length < 3) {
                spec = arguments[1];
                typename = spec.name;
            }

            if (typeof spec === 'function') {
                self._constructors[typename] = spec;
            } else if (spec.type === 'SoundModel') {
                self._constructors[typename] = wrapModel(self, spec);
            } else {
                throw new Error('Invalid model specification type - ' + (typeof spec));
            }
        };

        // Easier to use wrapper around defineNodeType for defining multiple
        // types in one call. `specs` is either an array of serialized models
        // as produced by `saveAsModel()` or an object those keys give the
        // type names and whose values give constructor functions (or serialized
        // models).

        function defineNodeTypes(self, specs) {
            if (specs.constructor === Array) {
                specs.forEach(function (cons) {
                    defineNodeType(self, cons);
                });
            } else if (specs.constructor === Object) {
                Object.keys(specs).forEach(function (typename) {
                    defineNodeType(self, typename, specs[typename]);
                });
            } else {
                throw new Error('Invalid node type collection');
            }
        };

        // Loader functions for the type types of serialized data.
        // A loader function is of the form function (aGraphNodeSet, json) { ... }
        // and can return anything it wants.
        var loaders = {
            GraphNodeSet: function (gnset, json) {
                var idmap = {destination: "destination"};

                var idspecmap = {};
                json.nodes.forEach(function (n) { idspecmap[n.id] = n; });

                function setupNode(nodeid) {
                    if (idmap[nodeid]) {
                        return gnset._nodes[idmap[nodeid]].node;
                    }
                    var spec = idspecmap[nodeid];
                    var setup = spec.setup;
                    console.assert(setup[0].fn === 'node');
                    var node = gnset.node.apply(gnset, setup[0].args);
                    idmap[nodeid] = node._gnset_id;
                    for (var i = 1, step, args; i < setup.length; ++i) {
                        var step = setup[i];
                        if (step.fn === "connect") {
                            args = step.args.slice(0);
                            args[0] = setupNode(args[0]); // Reify the target node.
                            node.connect.apply(node, args);
                        } else if (step.fn === "disconnect") {
                            node.disconnect.apply(node, step.args);
                        } else if (step.fn === "label") {
                            gnset.label(step.args[0], node);
                        }
                    }
                    return node;
                }

                json.nodes.forEach(function (spec) { setupNode(spec.id); });
                return gnset;
            },

            SoundModel: function (gnset, json) {
                return asNode(loaders.GraphNodeSet(gnset, json), json.inputs, json.outputs, json.params);
            }
        };

        
        // Takes a SoundModel type JSON object created using saveAsModel().
        //
        // The return value is a constructor function that you can use
        // with any GraphNodeSet to define a new model type. The argument
        // to the constructor function is an object whose keys give 
        // parameter names and whose values give the values that the parameters
        // should be set to.
        //
        // The returned constructor has a 'json' property that contains
        // the serialized JSON form of the wrapped model.
        function wrapModel(gnset, json) {
            console.assert(json.type === 'SoundModel');

            function soundModel(paramSettings) {
                var gns = new GraphNodeSet(this.audioContext, gnset); // Borrow definitions from gnset.
                var model = gns.load(soundModel.json);
                if (paramSettings) {
                    Object.keys(paramSettings).forEach(function (pname) {
                        model[pname].value = paramSettings[pname];
                    });
                }
                return model;
            }

            soundModel.json = json;

            return soundModel;
        };

        // Given arrays of labels that identify input and output nodes within
        // the graph set, asNode returns a SoundModel that wraps the entire 
        // subgraph. Note that asNode can itself be used within a constructor
        // function definition to load sound model definitions from a JSON
        // file, for example.
        //
        // For the specification of inputs, outputs and exposedParams
        // arguments, see GraphNodeSet.prototype.saveAsModel above.
        function asNode(self, inputs, outputs, exposedParams) {

            function labelToInputNode(label) {
                var node = self._nodes[label.node].node;
                return label.hasOwnProperty('pin') ? node.inputs[label.pin] : node;
            }

            function labelToOutputNode(label) {
                var node = self._nodes[label.node].node;
                return label.hasOwnProperty('pin') ? node.outputs[label.pin] : node;
            }
            
            function labelToNode(label) {
                return self._nodes[label].node;
            }

            var sm = steller.SoundModel({}, inputs.map(labelToInputNode), outputs.map(labelToOutputNode));

            if (exposedParams) {
                exposedParams.forEach(function (paramID) {
                    sm[paramID.name] = labelToNode(paramID.node)[paramID.nameInNode || paramID.name];
                    sm[paramID.name].value = paramID.value;
                });
            }

            return sm;
        };

        function checkInputsSpec(self, inputs) {
            inputs.forEach(function (spec) {
                if (spec.constructor !== Object) {
                    throw new Error('Invalid pin identifier ' + spec);
                }
                var node = spec.node;
                if (node._gnset !== self) {
                    throw new Error("Node doesn't belong to set.");
                }
                if (spec.hasOwnProperty('pin')) {
                    if (!node.inputs[spec.pin]) {
                        throw new Error('Invalid input pin number ' + spec.pin + ' for node "' + spec.node._gnset_id + '". Node has ' + node.inputs.length + ' input pins.');
                    }
                }
            });
        };

        function checkOutputsSpec(self, outputs) {
            outputs.forEach(function (spec) {
                if (spec.constructor !== Object) {
                    throw new Error('Invalid pin identifier ' + spec);
                }
                var node = spec.node;
                if (node._gnset !== self) {
                    throw new Error("Node doesn't belong to set.");
                }
                if (spec.hasOwnProperty('pin')) {
                    if (!node.outputs[spec.pin]) {
                        throw new Error('Invalid output pin number ' + spec.pin + ' for node "' + spec.node._gnset_id + '". Node has ' + node.outputs.length + ' output pins.');
                    }
                }
            });
        };


        function checkParamsSpec(self, paramIDs) {
            paramIDs.forEach(function (pid) {
                if (pid.constructor !== Object) {
                    throw new Error('Invalid parameter identifier ' + pid);
                }
                var node;
                var pname = pid.nameInNode || pid.name;
                if (!(node = self.get(pid.node))) {
                    throw new Error('Invalid node label "' + pid.node + '" for parameter "' + pname + '"');
                }
                if (!node.hasOwnProperty(pname)) {
                    throw new Error('Node labelled "' + pid.node + '" does not have a parameter named "' + pname + '"');
                }
            });        
        };
        
        return GraphNodeSet;
    };

});
