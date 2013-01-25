// A simple wrapper around the realtime analyzer node that fetches the
// magnitude spectrum (converting from decibels) periodically. The optional
// argument gives the number of bins desired (the fft size is double this).
// The bin count defaults to 1024 if unspecified.
//
// .bins is a Float32Array that will be kept updated with the power spectrum.
// .freqs is a constant Float32Array containing the frequency value of each bin.
// .time is a parameter whose value gives the time at which the spectrum was grabbed last.
//      You can 'watch' this parameter to be notified of each grab.
//
// You must run the .start action to start grabbing. You can stop 
// using the .stop action.
models.spectrum = function (N, smoothingFactor) {
    N = N || 1024;

    var analyser = AC.createAnalyser();
    analyser.fftSize = N * 2;
    analyser.frequencyBinCount = N;
    analyser.smoothingTimeConstant = arguments.length < 2 ? 0.1 : smoothingFactor;
    // Note that the analyser doesn't need to be connected to AC.destination.

    var model = SoundModel({}, [analyser], []);
    model.bins = new Float32Array(N);
    model.freqs = new Float32Array(N);
    model.time = Param({min: 0, max: 1e9, value: 0});

    // Compute the frequencies of the bins.
    for (var i = 0; i < N; ++i) {
        model.freqs[i] = i * AC.sampleRate / analyser.fftSize;
    }

    var grabRequest;

    function update() {
        if (grabRequest) {
            var ts = AC.currentTime;
            analyser.getFloatFrequencyData(model.bins);

            // Convert from decibels to power.
            for (var i = 0, bins = model.bins, N = bins.length; i < N; ++i) {
                bins[i] = Math.pow(10, bins[i] / 20);
            }

            grabRequest = steller.requestAnimationFrame(update);

            // Update the time stamp. If there are watchers installed
            // on model.time, they'll now be notified of the frame grab.
            model.time.value = ts;
        }
    }

    model.start = sh.fire(function () {
        if (!grabRequest) {
            grabRequest = steller.requestAnimationFrame(update);
        }
    });

    model.stop = sh.fire(function () {
        grabRequest = undefined;
    });

    return model;
};


