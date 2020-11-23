// Connect any single channel output to the input of this and read off
// mean signal value via the "mean" param. Also has a "sigma" param for the
// standard deviation. Note that if you want to know when mean or
// sigma change, you can 'watch' the params. This model has no
// outputs.
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    return function probe() {
        var mean = S.Param({ min: -1, max: 1, value: 0 });
        var sigma = S.Param({ min: -1, max: 1, value: 1 });
        var energy = S.Param({ min: 0, max: 1, value: 0 });

        var js = AC.createScriptProcessor(512, 1, 1);
        var sum = 0,
            sumSq = 0,
            k = 1 - Math.exp(Math.log(0.5) / 1024);

        js.onaudioprocess = function (e) {
            var b = e.inputBuffer.getChannelData(0);
            var N = b.length,
                i = 0,
                v = 0;
            for (i = 0; i < N; ++i) {
                v = b[i];
                sum += k * (v - sum);
                sumSq += k * (v * v - sumSq);
            }

            mean.value = sum;
            energy.value = sumSq;
            sigma.value = Math.sqrt(Math.max(0, sumSq - sum * sum));
        };

        js.connect(AC.destination); // TODO: FIXME: Is this necessary?

        var model = S.SoundModel({}, [js], []);
        model.mean = mean;
        model.sigma = sigma;
        model.energy = energy;

        return model;
    };
};
