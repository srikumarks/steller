////////////////////////////////////////////////////////
// EXPERIMENTAL javascript node wrapper
//
// The builtin Javascript Audio node is not as capable as the other
// native nodes in that it cannot have AudioParams and it only has one
// input and one output, albeit with multiple channels. 
//
// This model expands the API of the javascript audio node by giving
// it multiple single channel inputs and outputs instead and audioParams 
// that can be set and scheduled similar to other native nodes.
//
// One major limitation is that the inputs to the jsnode are limited
// to single-channel pins. This can in principle be lifted, but would
// complicate the API at the moment and is perhaps not all that useful.
// So I've decided to live with the single-channel restriction for the 
// moment.
//
// var jsn = models.jsnode({
//      numberOfInputs: 4,
//      numberOfOutputs: 5,
//      bufferLength: 512,
//      audioParams: {
//          gain: 1,
//          pitch: 1.5,
//          frequencyMod: 0.5
//      },
//      onaudioprocess: function (event) {
//          // The following are all Float32Arrays you can access -
//          //      event.inputs[i]
//          //      event.outputs[i]
//          //      event.gain, 
//          //      event.pitch, 
//          //      event.frequencyMod
//          //
//          // 'this' will refer to the jsn model object within this
//          // handler. So you can access other model parameters and methods.
//
//          // Return the number of samples processed. If you 
//          // return any value that is less than the length
//          // of the output buffer passed, it is taken as a signal
//          // to end the jsnode and cleanup. This can also be used
//          // to finish stuff like a reverb tail before killing 
//          // the node. `event.samplesToStop` gives the number of
//          // samples to generate before the indicated stop time
//          // arrives. This information can be used to determine
//          // tail characteristics too.
//          return event.outputs[0].length;
//      }
// });
//
// jsn.gain.value = 0.5;
// anotherGraphNode.connect(jsn, 0, 3);
// jsn.connect(AC.destination, 2);
//      // etc.
models.jsnode = function (spec) {

    // Map inputs to merger inputs numbered [0, spec.numInputs)
    // Map params to merger inputs numbered [spec.numInputs, spec.numInputs + numParams)
    // Map outputs to splitter outputs numbered [0, spec.numOutputs)
    var numParams = spec.audioParams ? spec.audioParams.length : 0;
    var numberOfInputs = spec.numberOfInputs || 0;
    var numberOfOutputs = spec.numberOfOutputs || 1;
    var numInputs = numberOfInputs + numParams;
    var numOutputs = numberOfOutputs;

    ASSERT(numberOfInputs >= 0);
    ASSERT(numberOfOutputs >= 0);
    ASSERT(numOutputs > 0);

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
        ASSERT(!('inputs' in spec.audioParams));
        ASSERT(!('outputs' in spec.audioParams));
        ASSERT(!('playbackTime' in spec.audioParams));
    } else {
        paramNames = [];
    }

    // Prepare the event object that will be passed to the jsnode
    // callback. We initialize all parameters here so that the
    // hidden class of obj will not change within onaudioprocess.
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
            // Prepare the buffers for access by the nested onaudioprocess handler.
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
                // samplesToStop gives number of samples of output remaining
                // before the node is expected to "stop". The node can,
                // however continue beyond the stop time by generating
                // more samples. It will be actually stopped only when it
                // generates fewer samples than requested, which is checked
                // using the return value. During "tail time", samplesToStop
                // will be negative.

            // Call the handler. We bypass the event object entirely since
            // there is nothing in there now that isn't present in `obj`.
            // The onaudioprocess can return the number of samples processed,
            // which is used to decide whether to continue processing the
            // sound or terminate it. If fewer samples are generated than
            // requested, then the node is stopped. This allows for some
            // tail time to follow a stoppage.
            samplesOutput = spec.onaudioprocess.call(sm, obj);
            if (samplesOutput === undefined) {
                // If the callback doesn't have a return statement,
                // then assume that it generates a whole buffer's worth.
                samplesOutput = t2 - t1;
            }
        } 

        if (t1 + samplesOutput < t2) {
            LOG(1, "Finished", t2, stopTime);
            hasFinished = true;
            setTimeout(autoDestroy, Math.round(bufferLength * 1000 / AC.sampleRate));
        }
    };

    var sm = SoundModel({}, inputNodes, outputNodes);

    // Make a dc model to drive the gain nodes corresponding to
    // audio parameters.
    var dc = paramNames.length > 0 ? models.dc(1) : undefined;
    paramNames.forEach(function (pn, i) {
        var node = inputNodes[numberOfInputs + i];
        sm[pn] = node.gain;

        // Initialize the AudioParams
        node.gain.value = spec.audioParams[pn];

        // Drive the param using the dc signal.
        dc.connect(node);

        // Make sure the user isn't shooting him/herself in
        // the foot by duplicate mentions of param names.
        ASSERT(!(paramNames[i] in obj), "Duplicate param name - ", paramNames[i]);
    });

    var kBufferLength = spec.bufferLength || 512;
    var jsn = sm.keep(AC.createScriptProcessor(kBufferLength, numInputs, Math.min(1, numOutputs)));
    merger && merger.connect(jsn); 
    jsn.onaudioprocess = onaudioprocess;
    var jsnDestination = splitter || AC.destination;

    // Takes the JSN out of the graph.
    autoDestroy = function () {
        hasFinished = true;
        jsn.disconnect();
        splitter && splitter.disconnect();
        dc && (dc.stop(0), dc.disconnect());
        merger && merger.disconnect();
        sm.drop(jsn);
        sm.emit && sm.emit('finished'); // Indicate that it's all over.
    };
    
    var startTimer;

    // Add start/stop methods depending on whether the node has any inputs
    // or not - i.e. on whether it is a "source node".
    sm.prepareAheadTime = 0.1; // seconds.

    if (numberOfInputs === 0) {
        // For source nodes (i.e. numberOfInputs === 0), start(t)
        // needs to be called to indicate when to begin generating audio.
        sm.start = function (t) {
            if (hasStarted || hasFinished) {
                // Same constraints as other nodes.
                return;
            }

            if (t) {
                // Schedule for the future, maybe.
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
                // Schedule immediately.
                hasStarted = true;
                jsn.connect(jsnDestination);
            }
        };
    } else {
        sm.start = undefined;
    }
    
    // All jsnodes know how to stop. This is necessary for garbage collection.
    // Even filter nodes need to know when to stop based on when source nodes
    // that drive it are stopped.
    sm.stop = function (t) {
        // A start has been scheduled or already running.
        if (hasFinished) {
            // Nothing to do.
            return;
        }

        stopTime = Math.max(startTime, Math.ceil(t * AC.sampleRate));
    };

    if (numberOfInputs > 0) {
        // Not a source node.
        // Cannot assume that start will be called.
        // Need to call it right away.
        sm.start(0);
    }
    
    return sm;
};


