// A simple noise gate model. It pipes the input through
// a compressor followed by a tuned biquad BPF.
//
// No parameters are currently exposed.
// TODO: Expose parameters of the compressor and the BPF.
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    // https://github.com/tennisonchan/noise-gate
    return function noisegate() {
        let dcn = AC.createDynamicsCompressor();
        dcn.threshold.setValueAtTime(-50, AC.currentTime);
        dcn.knee.setValueAtTime(40, AC.currentTime);
        dcn.ratio.setValueAtTime(12, AC.currentTime);
        dcn.reduction.setValueAtTime(-20, AC.currentTime);
        dcn.attack.setValueAtTime(0, AC.currentTime);
        dcn.release.setValueAtTime(0.25, AC.currentTime);

        let bpf = AC.createBiquadFilter();
        bpf.type = "bandpass";
        bpf.frequency.setValueAtTime(355, AC.currentTime);
        bpf.Q.setValueAtTime(8.3, AC.currentTime);

        let gain = AC.createGain();
        gain.gain.value = 3.0;

        dcn.connect(bpf);
        bpf.connect(gain);

        let model = S.SoundModel({}, [dcn], [gain]);
        return model;
    };
};
