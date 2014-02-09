define(['./eventable'], function (Eventable) {

    return function (steller) {

        // A graph node set helps keep track of a set of connected
        // GraphNode objects so that the network can be saved and
        // loaded across sessions. 
        //
        // TODO: Saving/Loading values of graph nodes' parameters is
        // not implemented yet.
        function GraphNodeSet(audioContext, nodeTypes) {
            this._nextID = 1;
            this._nodes = {destination: {node: audioContext.destination, setup: []}};
            this._audioContext = audioContext;
            this._constructors = {};
            audioContext.destination._gnset_id = "destination";
            if (nodeTypes) {
                this.defineNodeTypes(nodeTypes);
            }
            return this;
        }

        // When instantiating a graph node set, you need to first define
        // types of nodes by associating a name with their constructor
        // of the form `function (...) { .. return aSoundModel; }`
        // A new model instance will be created by first doing a
        // `new ConstructorFn(args...)`.
        // The arguments to init *must* all be JSON serializable values.
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
        GraphNodeSet.prototype.defineNodeType = function (typename, constructor) {
            if (arguments.length < 2) {
                this._constructors[constructor.name] = constructor;
            } else {
                this._constructors[typename] = constructor;
            }
        };

        // Easier to use wrapper around defineNodeType. Each key in consMap
        // is used as the typename and the value is used as the constructor.
        GraphNodeSet.prototype.defineNodeTypes = function (consMap) {
            var self = this;
            Object.keys(consMap).forEach(function (typename) {
                self.defineNodeType(typename, consMap[typename]);
            });
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
            var setup = [argv]; // The first setup specifies the gnset.node(..) call.
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
                var argv = Array.prototype.slice.call(arguments);
                argv[1] = argv[1]._gnset_id;
                setup.push(argv);
            });
            node.on('disconnect', function () {
                setup.push(Array.prototype.slice.call(arguments));
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

        // De-serialize a node graph from a JSON structure as produced by save() above;
        // You can load a new node set from a JSON like this -
        //      var gnset = new GraphNodeSet(audioContext, json);
        // or you can intake a graph into an existing graph node set like this -
        //      gnset.load(json);
        //
        GraphNodeSet.prototype.load = function (json) {
            var gnset = this;
            var idmap = {destination: "destination"};

            var idspecmap = {};
            json.nodes.forEach(function (n) { idspecmap[n.id] = n; });

            function setupNode(nodeid) {
                if (idmap[nodeid]) {
                    return gnset._nodes[idmap[nodeid]].node;
                }
                var spec = idspecmap[nodeid];
                var setup = spec.setup;
                var node = gnset.node.apply(gnset, setup[0]);
                idmap[nodeid] = node._gnset_id;
                for (var i = 1, step, args; i < setup.length; ++i) {
                    step = spec.setup[i];
                    if (step[0] === "connect") {
                        args = step.slice(1);
                        args[0] = setupNode(args[0]); // Reify the target node.
                        node.connect.apply(node, args);
                    } else if (step[0] === "disconnect") {
                        node.disconnect.apply(node, step.slice(1));
                    } else if (step[0] === "label") {
                        gnset.label(step[1], node);
                    }
                }
                return node;
            }

            json.nodes.forEach(function (spec) { setupNode(spec.id); });
            return gnset;
        };

        return GraphNodeSet;
    };

});
