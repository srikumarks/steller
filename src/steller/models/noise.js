
// A simple noise model. Makes a noise source
// that you can pipe to anywhere.
//
// Parameters = "spread" and "mean".
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    // Make a 5 second noise buffer (used in Chris Wilson's vocoder).
    // This ought to be enough randomness for audio.
    var noiseBuffer = AC.createBuffer(1, 5 * AC.sampleRate, AC.sampleRate);
    var i, N, data = noiseBuffer.getChannelData(0);
    for (i = 0, N = data.length; i < N; ++i) {
        data[i] = 2 * Math.random() - 1;
    }

    return function noise() {
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

        var model = S.SoundModel({}, [], [gain]);
        model.spread = S.Param({min: 0.01, max: 10.0, audioParam: source.gain, mapping: 'log'});
        model.mean = dc.level;

        return model;
    };

};


