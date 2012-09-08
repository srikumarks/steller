// Some simple examples to show usage of the Steller framework.
// https://github.com/srikumarks/steller


// Some helpers for the demos.
var steller = org.anclab.steller;       // Alias for namespace.
var util = steller.Util;

var AC = new webkitAudioContext();      // Make an audio context.

var sh = new steller.Scheduler(AC);     // Create a scheduler and start it running.
sh.running = true;
var models = steller.Models(sh);

// Shorthand for DOM element access.
function elem(id) {
    return document.getElementById(id);
}

elem('ting').onclick = function (event) {
    var t = models.chime();
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
    
    var t = models.chime();

    // The "tinger" is itself the output node for this model.
    var model = steller.GraphNode({}, [], [t]);

    // Sequenced tones.
    var arp = sh.track([
            t.play(60), sh.delay(1),
            t.play(64), sh.delay(1),
            t.play(67), sh.delay(1),
            t.play(69), sh.delay(1),
            t.play(67), sh.delay(1),
            t.play(64), sh.delay(1)
            ]);

    // The "playing" parameter indicates (and controls) whether
    // the sequence is playing or not.
    model.playing = steller.Param({min: 0, max: 1, value: 0});

    // Also expose the "halfLife" parameter of the tones being used.
    // Usually `exposeAs` will be used to give a different name according
    // to the perceptual quality of the parameter in the context of this
    // model, but in this case we just expose it as is.
    model.halfLife = t.halfLife;

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
    var rate = steller.Param({min: 0.001, max: 1000, value: 1, mapping: 'log'});

    elem('arpeggio_start').onclick = function (event) {
        // Note that you can click "start" again while a sequence is playing
        // to start another "in parallel", though all such sequences will be
        // controlled using the same rate and half life parameters and all
        // of them will be stopped by clicking "stop".
        sh.play(sh.track(sh.rate(rate), arp.start, arp.pattern));
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
        var r = Math.pow(10, value);
        elem('arpeggio_speed_value').innerText = '' + (Math.round(r * 100) / 100);
        rate.value = r;
    };
}());

(function () {
    var n;

    elem('noise').onclick = function () {
        if (n) {
            n.disconnect();
            elem('noiseUI').innerHTML = '';
            n = undefined;
        } else {
            n = models.noise();
            elem('noiseUI').insertAdjacentElement('beforeend', steller.UI.basicUI(document, n));
            n.spread.value = 0.05;
            n.connect(AC.destination);
        }
    };
}());

//========================================================================================
// 1-input oscillator for a-rate frequency modulation
//========================================================================================
function fmodOsc() {
    var osc = AC.createOscillator();
    osc.type = osc.SINE;
    osc.frequency.value = 220;

    var level = AC.createGainNode();
    level.gain.value = 1;
    osc.connect(level);

    var freqMix = AC.createGainNode();
    freqMix.gain.value = 1;
    freqMix.connect(osc.frequency);

    osc.noteOn(0);

    var model = steller.GraphNode({}, [freqMix], [level]);

    model.amplitude = steller.Param({min: 0.1, max: 1000.0, audioParam: level.gain, mapping: 'log'});
    model.f0 = steller.Param({min: 0.1, max: 1000.0, audioParam: osc.frequency, mapping: 'log'});

    return model;
}

(function () {
    var o, o2;
    var uidiv = elem('fmodOscUI');

    elem('fmodOsc').onclick = function () {
        if (o) {
            o.disconnect();
            uidiv.innerHTML = '';
            o = o2 = undefined;
        } else {
            o = fmodOsc();
            uidiv.insertAdjacentElement('beforeend', steller.UI.basicUI(document, o));    

            o2 = fmodOsc();
            uidiv.insertAdjacentElement('beforeend', steller.UI.basicUI(document, o2, 'Modulation'));            
            o2.f0.value = 5;
            o2.amplitude.value = 5;
            o2.connect(o);

            o.amplitude.value = 0.2;
            o.connect(AC.destination);
        }
    };
}());

// A simple noise modulated oscillator model.    
function noisyFM(filterNode) {
    var	gainLevelNode = AC.createGainNode();
    gainLevelNode.gain.value = 0.5;

    var model = steller.GraphNode({}, [], [gainLevelNode]);

    model.level = steller.Param({min: 0, max: 1, audioParam: gainLevelNode.gain});
    model.attackTime = steller.Param({min: 0.01, max: 10.0, value: 0.05, mapping: 'log'});
    model.releaseTime = steller.Param({min: 0.01, max: 10.0, value: 1.0, mapping: 'log'});
    model.noise = steller.Param({min: 0.01, max: 1000.0, value: 10.0, mapping: 'log'});
    
    // Makes a "voice" with methods -
    //      noteOn(pitch, vel), 
    //      noteOff, 
    //      note(pitch, vel, dur) and 
    //      dispose
    function voice() {
        var v = {};
        var noiseModulatorNode      = models.noise();
        var carrierNode             = fmodOsc();
        var gainEnvNode             = AC.createGainNode();
        gainEnvNode.gain.value      = 0;

        if (filterNode) {
            // Insert a filter between the noise and the rest.
            // Note that this can be an arbitrary model that has
            // one input and one output.
            noiseModulatorNode.connect(filterNode);
            filterNode.connect(carrierNode);
            Param.expose(filterNode, model);
        } else {
            // No filter node.
            noiseModulatorNode.connect(carrierNode);
        }

        carrierNode.connect(gainEnvNode);
        gainEnvNode.connect(gainLevelNode);

        v.noteOn = function (pitchNumber, velocity) {
            return sh.fire(function (clock) {
                noiseModulatorNode.spread.value = model.noise.value;
                carrierNode.f0.value            = util.p2f(pitchNumber);
                gainEnvNode.gain.setTargetValueAtTime(velocity.valueOf(), clock.t1, model.attackTime.value / 3);
            });
        };

        v.noteOff = sh.fire(function (clock) {
            gainEnvNode.gain.setTargetValueAtTime(0, clock.t1, model.releaseTime.value / 3);
        });

        v.note = function (pitchNumber, velocity, duration) {
            return sh.track(v.noteOn(pitchNumber, velocity), sh.delay(duration), v.noteOff);
        };

        v.dispose = sh.fire(function (clock) {
            gainEnvNode.disconnect();
            if (filterNode) {
                noiseModulatorNode.disconnect();
                filterNode.disconnect();
            }
            noiseModulatorNode = carrierNode = gainEnvNode = undefined;
            delete v.noteOn;
            delete v.noteOff;
            delete v.note;
            delete v.dispose;
        });

        return v;
    }

    model.voice = voice;

    return model;
}

(function () {
    var v, N, n = false;
    var uidiv = elem('noisyFMUI');

    elem("noisyFM").onclick = function (e) {
        if (!v) {
            var N = noisyFM();
            uidiv.insertAdjacentElement('beforeend', steller.UI.basicUI(document, N));
            N.level.value = 0.2;
            N.attackTime.value = 0.1;
            N.releaseTime.value = 2;
            N.noise.value = 10.0;
            N.connect(AC.destination);
            v = N.voice();
        }

        if (n) {
            sh.play(v.noteOff);
            n = false;
        } else {
            sh.play(v.noteOn(60, 1.0));
            n = true;
        }
    };
}());


