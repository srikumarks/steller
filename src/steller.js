// Copyright (c) 2012 National University of Singapore
// Inquiries: director@anclab.org
// Author: Srikumar K. S. (http://github.com/srikumarks)
//
// #### License
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/lgpl.html>.

// ## Introduction
//
// The [Web Audio API] provides facilities for generating and processing sounds
// within a browser using Javascript. It has already seen wide adoption and is
// shipping in Chrome and Safari 6. It provides the basic modules necessary for
// building intuitive sound models, but leaves further abstraction to developers.
// [Steller] is an set of basic tools for building such re-usable sound models
// that co-operate with the Web Audio API.
// 
// We want to be able to build abstract "sound models" with intuitive parameters
// for controlling them. The basic characteristics of sound models that we're
// looking at are the following -
// 
// 1. Sound models generate sound though one or more outputs. They may optionally
//    process input sounds as well, in which case they are sound *transformation*
//    models.
// 
// 2. They have parameters that control the generation or transformation in real
//    time. The animation of these parameters can be coordinated precisely.
// 
// 3. Sound models may use other sound models internally. This lets us build more
//    complex models out simpler ones and encapsulate them. A useful design
//    principle is to make the interfaces of sound models to be static and keep
//    all dynamic aspects internal to it.
//
// [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
// [Web Audio API]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html
// [Steller]: https://raw.github.com/srikumarks/jsaSound/master/steller_api/steller.js 
// 
// ## Design ##
// 
// [Steller] realizes the important aspects of sound models mentioned above using
// the `GraphNode` object transformer and `Param` objects. `GraphNode` can impart
// node-like behaviour to an object. `Param` objects can be animated, watched and shared.
// Therefore a "base" sound model is an `Eventable GraphNode`.
// 
// We also need the ability to schedule these sounds. This facility is needed both
// for internal use by sound models as well as for the sound model user. This
// need arises from the fact that we want sound models to be compositional - i.e.
// a sound model can be the "user" of another sound model. The `Scheduler` is an
// orthogonal component that serves this purpose.
// 
// #### GraphNode
//
// The `GraphNode` encapsulates a signal processing graph and lets you use it as a
// single node in a larger graph. This way, larger graphs can be built using
// encapsulated smaller graphs. 
// 
// #### The Scheduler
// 
// A broad-stroke description of a sound model's function is that it organizes
// sounds and their processing in time. The `Scheduler`'s job is to facilitate
// that. Here is an example of using the scheduler to print "one" followed by
// "two" on the console after 3 seconds. (This shows that the scheduler isn't
// limited to performing audio activity alone.)
// 
//     // Make a new scheduler that uses the given audio 
//     // context's "currentTime" as its time base. You
//     // can also use an existing `audioContext`.
//     var audioContext = new webkitAudioContext(); 
//     var sh = new Scheduler(audioContext);
// 
//     // Start it running.
//     sh.running = true;
// 
//     // "print" makes a scheduler action that will 
//     // print the given message.
//     function print(msg) {
//         return sh.fire(function (clock) {
//             console.log(msg);
//         });
//     }
// 
//     // Using the scheduler's "track" combinator, make an 
//     // action that says "two" should follow "one" after 
//     // 3 seconds.
//     var one_and_two = sh.track( print("one")
//                               , sh.delay(3.0)
//                               , print("two") 
//                               );
// 
//     // "Play" it.
//     sh.play(one_and_two);
// 
// 
// In order to help make sound models composeable in time, the `Scheduler`
// separates the *specification* of temporal behaviour from the realization of the
// specification. This is a different design from the conventional notion of a
// scheduler whose interface is thought to be "make event E happen at time T".
// Instead, the separation of specification from realization encourages the sound
// model designer to think in terms of the temporal relationship between the sonic
// elements that play a part in its output. For example, when we want event B to
// happen DT seconds after event A, with a conventional scheduler we need to say
// "make A happen at T1 and B happen at T1+DT". What we want to do is to state the
// interval relationship between the two events and leave it to the context in
// which these two events are used to decide what T1 must be. This then lets a
// higher level sound model then say "AB must follow 1.5 seconds after C", when
// treating AB as a single unit.
// 
// The methods of the `Scheduler` object therefore create such specifications - or
// "actions" - often using other specifications. There is a single `play` function
// that realizes a given action.
// 
// The scheduler determines timing for the events using `Clock` objects. A clock
// object is passed between events that are declared to be part of a single
// temporal sequence - a.k.a. "track". The time of the clock advances as it is
// passed between consecutive events in a track. You can have multiple tracks that
// can be `spawn`ed or `fork`ed to run in parallel. Each such parallel track gets
// its own clock object, which enables such tracks to have their own timing
// characteristics. 


// # The Steller API
//
// With the above summary, we move on to the specifics of the Steller API.
// To start with, the Steller API is exposed as a global "package" named
// `org.anclab.steller`. So, for example, you access the `GraphNode` transformer 
// as `org.anclab.steller.GraphNode`.
define(["./steller/dbg", "./steller/nexttick", "./steller/eventable", "./steller/async_eventable", "./steller/graphnode", "./steller/patch", "./steller/param", "./steller/scheduler", "./steller/clock", "./steller/periodictimer", "./steller/jsnodetimer", "./steller/ui", "./steller/util", "./steller/models"],
function (GLOBAL, nextTick, Eventable, AsyncEventable, GraphNode, Patch, Param, Scheduler, Clock, PeriodicTimer, JSNodeTimer, UI, Util, Models) {

    var steller = {};

    //
    // ## SoundModel
    //
    // A "sound model" is a graph node with support for parameters.
    // It is also "eventable" in that you can install watchers
    // for events that are "emit"ed, perhaps by internal
    // processes (see Eventable).
    //
    // `obj` is the object to turn into a "sound model"
    // 
    // `inputs` is the array of graph nodes (or sound models) that constitute
    // the input for this model.
    //
    // `outputs` is the array of graph nodes (or sound models) that constitute
    // the output for this model.
    //
    // By making the inputs and outputs explicit, we can make
    // sound models whose output can be piped through other models
    // before it hits the audio context's destination.
    //
    // Sound models are scheduled using the Scheduler (org.anclab.steller.Scheduler)
    //
    function SoundModel(obj, inputs, outputs) {
        var node = Eventable(GraphNode(obj, inputs, outputs));
        
        // Patch connect/disconnect methods to emit events
        // after the action is complete, so that other things
        // such as UI, cleanup, whatever can react to them.
        Eventable.observe(node, 'connect');
        Eventable.observe(node, 'disconnect');

        return node;
    }

    steller.nextTick      = nextTick;
    steller.Eventable     = Eventable;
    steller.AsyncEventable  = AsyncEventable;
    steller.GraphNode     = GraphNode;
    steller.Patch         = Patch(steller);
    steller.SoundModel    = SoundModel;
    steller.Param         = Param;
    steller.Scheduler     = Scheduler;
    steller.Clock         = Clock;
    steller.PeriodicTimer = PeriodicTimer;
    steller.JSNodeTimer   = JSNodeTimer;
    steller.UI            = UI;
    steller.Util          = Util;

    // Expose the ones that we use.
    steller.requestAnimationFrame = (function (raf) {
        return function (func) {
            return raf(func);   // This is so that steller.requestAnimationFrame
                                // can be called with anything as "this".
        };
    }(Util.getRequestAnimationFrameFunc()));
    steller.AudioContext = Util.getAudioContext();

    steller.Scheduler.Models = function (sh) { Models(steller, sh); };

    return steller;
});
