
// A DC source with a "level" parameter.
module.exports = function installer(S, sh) {

    var i, N, data, dcBuffer;
    var AC = sh.audioContext;

    // Make a 1024-sample buffer for generating dc offset values.
    // In principle you only need a one sample buffer, but Chris Rogers
    // says the webkit implementation is less efficient for the 1-sample
    // case.
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

        var model = S.SoundModel({}, [], [gain]);
        model.level = S.Param({min: -1.0, max: 1.0, audioParam: gain.gain});
        model.stop = function (t) {
            dc.stop(t);
        };

        return model;
    };

};

