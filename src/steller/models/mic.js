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

    function getUserMedia(dictionary, callback, errback) {
        try {
            navigator.mediaDevices.getUserMedia(dictionary).then(callback).catch(errback);
        } catch (e) {
            errback(e);
        }
    }

    function setupMic(micModel, stream) {
        if (!micModel.source) {
            ASSERT(stream);
            micModel.source = AC.createMediaStreamSource(stream);
        }

        micModel.source.connect(micModel.outputs[0]);
        micModel.error = null;
        let settings = stream.getAudioTracks()[0].getSettings();
        micModel.latency_secs = settings.latency || undefined;  // Latency may not be available,
                                                                // in which case we mark it as
                                                                // undefined.
        micModel.ready.value = 1;
    }

    return function mic() {
        var micOut = AC.createGainNode();
        var micModel = S.SoundModel({}, [], [micOut]);

        micModel.source = null; // This is the stream source node.

        // 'ready' parameter = 1 indicates availability of mic,
        // -1 indicates error (in which case you can look at micModel.error)
        // and 0 indicates initialization in progress.
        micModel.ready = S.Param({min: -1, max: 1, value: 0});

        // Expose a gain parameter so different parts of the graph can use
        // different gains.
        micModel.gain = S.Param({min: 0, max: 1, audioParam: micOut.gain});

        micModel.stop = function (t) {
            micModel.source.mediaStream.getAudioTracks()[0].stop();
            micModel.source.disconnect();
            micModel.source = null;
            micModel.ready.value = 0;
        };

        micModel.start = function (t) {
            if (micModel.source) {
                setupMic(micModel, null);
            } else {
                // We turn off autoGainControl and such automatic processing 
                // available with some systems because they generally play havoc
                // with musical intentions.
                getUserMedia({
                    audio: { latency: {min: 0.0, max: 0.05, ideal: 0.015},
                             echoCancellation: false,
                             autoGainControl: false,
                             noiseSuppression: false
                    }},
                    function (stream) {
                        return setupMic(micModel, stream);
                    },
                    function (e) {
                        micModel.error = e;
                        micModel.gain.value = 0; // Mute it.
                        micModel.ready.value = -1;
                    });
            }
        };

        // Start it by default already.
        micModel.start(0);

        return micModel;
    };
};


