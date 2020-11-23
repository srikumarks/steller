//
// ## GraphNode
//
// Makes an object into a node that can be used in a signal
// processing graph with the Web Audio API.
//
// node = an object that you want to quack like a node.
// inputs = array of nodes that have open inputs in the graph.
// outputs = array of nodes that have open outputs in the graph.
//
// For simplicity. I provide a "strict" version of multichannel
// support for illustration, but you may want something
// smarter with auto-fanout, auto-mixdown, etc.
//
// Note that the graphNode is compositional in nature - i.e. you can
// treat smaller node graphs as nodes in a larger nor graph, which is what
// you want, I guess.
//
// The above implementation has a disadvantage due to the fact that the
// protocol for determining pins *inside* an AudioNode is not exposed.
// Therefore you can connect the output of a wrapped node to an input of
// a regular AudioNode, but not vice versa. However, you can wrap any
// plain AudioNode `n` using `GraphNode({}, [n], [n])` after which
// you'll have to deal with only wrapped nodes ... and all is well :)
//
// Of course, if you're wrapping all audio nodes anyway, you're free to
// depart from the "connect" protocol and implement it any way you like :D
//

function GraphNode(node, inputs, outputs) {
    node.inputs = inputs || [];
    node.outputs = outputs || [];

    node.numberOfInputs = node.inputs.length;
    node.numberOfOutputs = node.outputs.length;
    ASSERT(node.numberOfInputs + node.numberOfOutputs > 0);

    // Get the audio context this graph is a part of.
    node.context =
        (node.inputs[0] && node.inputs[0].context) ||
        (node.outputs[0] && node.outputs[0].context);
    ASSERT(node.context);

    // ### connect
    //
    // Same function signature as with the Web Audio API's [AudioNode].
    //
    // [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
    node.connect = function (target, outIx, inIx) {
        var i, N, inPin, outPin;

        /* If the target is not specified, then it defaults to the destination node. */
        target = target || node.context.destination;

        /* Set default output pin indices to 0. */
        outIx = outIx || 0;
        inIx = inIx || 0;
        outPin = node.outputs[outIx];

        /* The "receiving pin" could be a simple AudioNode
         * instead of a wrapped one. */
        inPin = target.inputs ? target.inputs[inIx] : target;

        if (
            inPin.constructor.name === "AudioParam" ||
            inPin.constructor.name === "AudioGain"
        ) {
            // a-rate connection.
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

    // ### disconnect
    //
    // Same function signature as with the Web Audio API's [AudioNode].
    // ... but we also support providing the pin numbers to disconnect
    // as arguments.
    //
    // [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
    node.disconnect = function () {
        if (arguments.length > 0) {
            /* Disconnect only the output pin numbers identified in
             * the arguments list. */
            Array.prototype.forEach.call(arguments, function (n) {
                node.outputs[n].disconnect();
            });
        } else {
            /* Disconnect all output pins. This is also the
             * behaviour of AudioNode.disconnect() */
            node.outputs.forEach(function (n) {
                n.disconnect();
            });
        }

        return node;
    };

    // ### keep and drop
    //
    // Javascript audio nodes need to be kept around in order to prevent them
    // from being garbage collected. This is a bug in the current system and
    // `keep` and `drop` are a temporary solution to this problem. However,
    // you can also use them to keep around other nodes.

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
var nodeIDKey = "#org.anclab.steller.GraphNode.globalid";

function getOrAssignNodeID(node) {
    var id = node[nodeIDKey];
    if (!id) {
        id = nextNodeID++;
        Object.defineProperty(node, nodeIDKey, {
            value: id,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    }
    return id;
}

// Keep references to nodes that need to be explicitly preserved.
// This currently applies to JS audio nodes, because the system
// seems to throw away references to it even if it is running.
// Use the keep()/drop() methods to preserve or discard nodes.
GraphNode._preservedNodes = {};

// Takes an array of nodes and connects them up in a chain.
GraphNode.chain = function (nodes) {
    var i, N;
    for (i = 0, N = nodes.length - 1; i < N; ++i) {
        nodes[i].connect(nodes[i + 1]);
    }
    return GraphNode;
};

module.exports = GraphNode;
