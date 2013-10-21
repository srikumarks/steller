
// buffer_queue
//
// A model to which you can submit AudioBuffers to be played
// back in FIFO order. If you're computing audio buffers in JS,
// you can treat this as a pump. You can, for example, create
// Float32Arrays in a JS worker and pump it to the audio output
// using this queue. Also features a simple timer to get a 
// just-in-time callback to keep the queue flowing.
//
// Example code to play a sine wave -
//
/*
   var ac = new AudioContext;
   var sh = new org.anclab.steller.Scheduler(ac);
   var q = sh.models.buffer_queue();
   q.connect(ac.destination);
   q.start(ac.currentTime);
   q.schedule(function () {
       var phase = 0.0, dphase = 2.0 * Math.PI * 440.0 / 44100.0;
       return function (q) {
           var audioBuffer = q.createBuffer(1, 1024);
           var chan = audioBuffer.getChannelData(0);
           var i;
           for (i = 0; i < 1024; ++i) {
               chan[i] = 0.2 * Math.sin(phase);
               phase += dphase;
           }
           q.enqueue(audioBuffer);
           q.schedule(arguments.callee);
       };
   }());
*/
//
//
// model.gain is a Param that controls the output gain of the queue.
// 
// model.start(time) will start the queue at the given time. You can
// start the queue only once. Subsequent calls will be a no-op.
//
// model.enqueue(audioBuffer|channelArray|Float32Array) will enqueue
// the given buffer to be played after the already enqueued buffers
// are done. If the argument is an AudioBuffer object, then it is
// added to the queue by reference and not copied for efficiency. 
// The other Float32Array based objects will first be converted 
// into an AudioBuffer before being added to the queue and therefore 
// can be reused.
//
// model.createBuffer(channels, length) is a convenience method
// for creating an AudioBuffer that uses the audio context's
// sampling rate.
//
// model.latency_secs will give the "currentTime" (according to the
// audio context) at which the next buffer submitted will begin playing.
//
// model.schedule(function (model) {}) will schedule the given function
// to be called back just in time for the queue to be emptied. The amount
// of "prepare ahead time" available can be set through model.kPrepareAheadTime_ms.
// You can therefore use schedule() with a callback as a way to 
// generate audio.
//
models.buffer_queue = function () {

    var output = AC.createGainNode();
    var model = SoundModel({}, [], [output]);

    var startTime = -1.0;
    var nextBufferTime = -1.0;
    var queue = [];
    var queueDuration = 0.0;

    model.gain = Param({min: -10.0, max: 10.0, audioParam: output.gain, mapping: 'log'});

    function flushQueue() {
        // Don't play buffers into the past since the engine
        // will deliver them all simultaneously.
        if (nextBufferTime < AC.currentTime) {
            nextBufferTime = AC.currentTime;
        }

        var source, nextBuffer, i;

        while (queue.length > 0) {
            source = AC.createBufferSource();
            nextBuffer = queue.shift();
            source.buffer = nextBuffer;
            source.connect(output);
            source.start(nextBufferTime);
            nextBufferTime += nextBuffer.length / AC.sampleRate; // @fixme Cumulative errors here?
        }

        queueDuration = 0.0;
    }

    model.createBuffer = function (channels, length) {
        return AC.createBuffer(channels, length, AC.sampleRate);
    };

    model.enqueue = function (audioBuffer) {
        var queuedBuffer, i;

        if (!audioBuffer.getChannelData) {
            if (audioBuffer.constructor === Array) {
                for (i = 0; i < audioBuffer.length; ++i) {
                    if (audioBuffer[i].length !== audioBuffer[0].length) {
                        throw new Error('steller:buffer_queue: Inconsistent channel sizes.');
                    }
                }
                queuedBuffer = model.createBuffer(audioBuffer.length, audioBuffer[0].length);
                for (i = 0; i < audioBuffer.length; ++i) {
                    queuedBuffer.getChannelData(i).set(audioBuffer[i]);
                }
            } else if (audioBuffer.constructor === Float32Array) {
                queuedBuffer = model.createBuffer(1, audioBuffer.length);
                queuedBuffer.getChannelData(0).set(audioBuffer);
            } else {
                throw new Error('steller.buffer_queue: Unsupported buffer object.');
            }
        } else {
            queuedBuffer = audioBuffer;
        }

        queue.push(queuedBuffer);
        queueDuration += queuedBuffer.duration;

        if (startTime < 0.0) {
            return model;
        }

        flushQueue();

        return model;
    };

    model.start = function (t) {
        if (startTime < 0.0) {
            // Not started yet. Start it.
            startTime = nextBufferTime = Math.max(t, AC.currentTime);
            flushQueue();
        }

        return model;
    };

    model.__defineGetter__('latency_secs', function () {
        // If not started yet, return invalid 0.0 value.
        return queueDuration + (startTime < 0.0 ? 0.0 : Math.max(0.0, nextBufferTime - AC.currentTime));
    });

    model.kPrepareAheadTime_ms = 50;

    model.schedule = function (callback) {
        if (startTime < 0.0) {
            throw new Error('steller.buffer_queue: Need to start buffer queue before scheduling.');
        }

        var delay_ms = Math.floor(model.latency_secs * 1000);

        if (delay_ms > model.kPrepareAheadTime_ms) {
            setTimeout(callback, Math.floor(delay_ms - model.kPrepareAheadTime_ms), model);
        } else {
            steller.nextTick(function () { callback(model); }); // Call right away. Not enough time left.
        }
    };
 
    return model;
};


