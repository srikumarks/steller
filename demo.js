// Some simple examples to show usage of the Steller framework.
// https://github.com/srikumarks/steller


// Some helpers for the demos.
var steller = org.anclab.steller;       // Alias for namespace.

var AC = new webkitAudioContext();      // Make an audio context.

var sh = new steller.Scheduler(AC);     // Create a scheduler and start it running.
sh.running = true;

// Shorthand for DOM element access.
function elem(id) {
    return document.getElementById(id);
}

// The "ting" model plays a tone with an exponential decay. This component
// is designed so that it can play multiple "ting"s through the output of
// the same graph node. You may want this in some circumstances, and not in
// others and both are expressible using the Steller framework.
//
// @param sh is a Scheduler instance.
function ting(sh) {

    var output = AC.createGainNode();
    var model = steller.SoundModel({}, [], [output]);

    // halfLife parameter determines the amplitude decay half life (in secs) of
    // a ting at 440Hz.
    model.params.define({name: 'halfLife', min: 0.001, max: 10, value: 0.5});
    
    function play(pitchNumber) {
        return sh.fire(function (clock) {
            var f = 440 * Math.pow(2, (pitchNumber.valueOf() - 69) / 12);
            var osc = AC.createOscillator();
            osc.type = osc.SINE;
            osc.frequency.value = f;

            var gain = AC.createGainNode();
            osc.connect(gain);
            gain.connect(output);
            gain.gain.setValueAtTime(1/8, clock.t1);

            var halfLife = model.halfLife.value * 440 / f;
            var dur = halfLife * 12;
            gain.gain.exponentialRampToValueAtTime(1/32768, clock.t1 + dur);
            osc.noteOn(clock.t1);
            osc.noteOff(clock.t1 + dur);
        });
    }

    // You can play multiple tings all mixed into the same output gain node.
    // Note that there is no standard way to "play" or "stop" any sound model.
    // This is left open since models may need different behaviours in this
    // regard. For this model, `.play(noteNumber)` is a method that makes
    // an action meant to be passed to the scheduler.
    model.play = play;

    return model;
} 

elem('ting').onclick = function (event) {
    var t = ting(sh);
    t.connect(AC.destination);

    // Play an intro chime.
    var hello = sh.track([60, 64, 67, 72].map(function (p) { 
        return sh.track(t.play(p), sh.delay(0.25));
    }));

    sh.play(hello);
};

// The arpeggio model plays a sequence of tones in a loop.  The loop is
// started/stopped using the "start" and "stop" buttons in the UI.
function arpeggio(sh) { 
    
    var t = ting(sh);

    // The "tinger" is itself the output node for this model.
    var model = steller.SoundModel({}, [], [t]);

    // Sequenced tones.
    var arp = sh.track( t.play(60), sh.delay(1)
                      , t.play(64), sh.delay(1)
                      , t.play(67), sh.delay(1)
                      , t.play(69), sh.delay(1)
                      , t.play(67), sh.delay(1)
                      , t.play(64), sh.delay(1)
                      );

    // The "playing" parameter indicates (and controls) whether
    // the sequence is playing or not.
    model.params.define({name: "playing", min: 0, max: 1, value: 0});

    // Also expose the "halfLife" parameter of the tones being used.
    // Usually `exposeAs` will be used to give a different name according
    // to the perceptual quality of the parameter in the context of this
    // model, but in this case we just expose it as is.
    model.params.expose(t, "halfLife");

    // An action that sets playing state to "playing".
    model.start = sh.fire(function () {
        model.playing.value = 1;
    });
   
    // An action that sets playing state to "not playing".  The stopping will
    // always occur at the end of a complete arpeggio sequence.
    model.stop = sh.fire(function () {
        model.playing.value = 0;
    });

    // The pattern to play.
    model.pattern = sh.loop_while(model.playing, arp);

    return model;
}

(function () {
    var arp = arpeggio(sh);
    arp.connect(AC.destination); // We can optionally pipe this through effects before
                                // hitting the destination node.

    // Make a parameter for controlling the rate of playback.
    // We'll set the rate "by reference" so that changes to it
    // can take effect between individual notes of the arpeggio.
    var p = steller.Parameterize({});
    p.params.define({name: "rate", min: 0.001, max: 1000, value: 1});

    elem('arpeggio_start').onclick = function (event) {
        // Note that you can click "start" again while a sequence is playing
        // to start another "in parallel", though all such sequences will be
        // controlled using the same rate and half life parameters and all
        // of them will be stopped by clicking "stop".
        sh.play(sh.track(sh.rate(p.rate), arp.start, arp.pattern));
    };

    elem('arpeggio_stop').onclick = function (event) {
        sh.play(arp.stop);
    };

    elem('ting_halflife').onchange = function (event) {
        var value = parseFloat(this.value);
        var halfLife = Math.pow(10, value);
        elem('ting_halflife_value').innerText = '' + (Math.round(halfLife * 1000) / 1000) + ' secs';
        arp.halfLife.value = halfLife;
    };

    elem('arpeggio_speed').onchange = function (event) {
        var value = parseFloat(this.value);
        var rate = Math.pow(10, value);
        elem('arpeggio_speed_value').innerText = '' + (Math.round(rate * 100) / 100);
        p.rate.value = rate;
    };
}());



