// mic support
//
// Has a single output that serves up the audio stream coming
// from the computer's microphone. Since setting up the microphone
// needs async calls, the constructed model exposes a 'ready'
// parameter that you can watch to determine when the mic is ready.
//
// If the ready parameter is -1, it means mic is not supported or
// some error occurred. If it is +1, then all systems are a go. It
// remains at 0 during initialization.
//
// Under normal circumstances, you can write code pretending that
// the user will grant mic input and setup all the graphs you need,
// ignoring `ready` status. Then when mic input is available, it
// will automatically flow through the graph you've setup. This is
// because the mic model exposes its output immediately as a gain node.
// If you ignore ready, then lack of permission to access the mic will
// be equivalent to a mic input that generates pure silence.
//
// Minimal code sample -
//
//      var models = org.anclab.steller.Models(sh);
//      var mic = models.mic();
//      mic.connect(sh.audioContext.destination); // .. or wherever.
//
//      // If you want...
//      mic.ready.watch(function (status) {
//          if (status === -1) {
//              alert('Mic input access not granted. ' + mic.error);
//          } else {
//              ASSERT(status === 1);
//          }
//      });
module.exports = function installer(S, sh) {
    let AC = sh.audioContext;

    let audioConstraints = {
        audio: {
            latency: { min: 0.0, max: 0.05, ideal: 0.015 },
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
        },
    };

    function getUserMedia(dictionary, callback, errback) {
        try {
            navigator.mediaDevices
                .getUserMedia(dictionary)
                .then(callback)
                .catch(errback);
        } catch (e) {
            errback(e);
        }
    }

    function setupMic(micModel) {
        if (!micModel.source && micModel.stream) {
            micModel.source = AC.createMediaStreamSource(micModel.stream);
        }

        if (!micModel.source) {
            throw new Error("Mic source not initialized");
        }

        micModel.source.connect(micModel.outputs[0]);
        micModel.error = null;
        let settings = micModel.stream.getAudioTracks()[0].getSettings();
        micModel.latency_secs = settings.latency || undefined; // Latency may not be available,
        // in which case we mark it as
        // undefined.
        micModel.ready.value = 1;
    }

    function mic(options) {
        var micOut = AC.createGainNode();
        var micModel = S.SoundModel({}, [], [micOut]);

        micModel.stream = null; // This is the stream attached to the source node.
        micModel.source = null; // This is the stream source node.

        // 'ready' parameter = 1 indicates availability of mic,
        // -1 indicates error (in which case you can look at micModel.error)
        // and 0 indicates initialization in progress.
        micModel.ready = S.Param({ min: -1, max: 1, value: 0 });

        // Expose a gain parameter so different parts of the graph can use
        // different gains.
        micModel.gain = S.Param({ min: 0, max: 1, audioParam: micOut.gain });

        // A model to stop the mic before proceeding.
        micModel.stop = function (sh, clock, next) {
            if (micModel.source) {
                micModel.source.mediaStream.getAudioTracks()[0].stop();
                micModel.source.disconnect();
                micModel.source = null;
                micModel.ready.value = 0;
            }
            next(sh, clock, sh.stop);
        };

        // A model which will continue only when mic request either succeeds
        // or fails. Failure can be detected by examining the .ready.value
        // property, which will be 0 if the request failed.
        micModel.start = function (sh, clock, next) {
            if (micModel.source) {
                // We're ready already.
                next(sh, clock, sh.stop);
            } else if (micModel.stream) {
                setupMic(micModel);
                next(sh, clock, sh.stop);
            } else {
                // We turn off autoGainControl and such automatic processing
                // available with some systems because they generally play havoc
                // with musical intentions.
                getUserMedia(
                    audioConstraints,
                    function (stream) {
                        if (stream) {
                            micModel.stream = stream;
                            micModel.start(sh, clock, next);
                        } else {
                            next(sh, clock, sh.stop);
                        }
                    },
                    function (e) {
                        micModel.error = e;
                        micModel.gain.value = 0; // Mute it.
                        micModel.ready.value = -1;
                        console.error(e);
                        next(sh, clock, sh.stop);
                    }
                );
            }
        };

        // Start by default, but if an option to suppress start is
        // given, respect that.
        if (!(options && options.dontStart)) {
            sh.play(micModel.start);
        }

        return micModel;
    }

    return mic;
};
