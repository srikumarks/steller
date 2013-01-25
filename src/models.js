// Copyright (c) 2012 Srikumar K. S. (http://github.com/srikumarks)
// All rights reserved.
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

// Must've loaded steller.js before this.
ASSERT(org.anclab.steller);

org.anclab.steller.Util.augment('Models',
function (sh) {
    var steller         = org.anclab.steller;
    var util            = org.anclab.steller.Util;
    var SoundModel      = steller.SoundModel;
    var GraphNode       = steller.GraphNode;
    var Param           = steller.Param;

    var AC = sh.audioContext;
    var models = this;

#include "models/chime.js"
#include "models/dc.js"
#include "models/noise.js"
#include "models/probe.js"
#include "models/mic.js"
#include "models/spectrum.js"
#include "models/sample.js"
#include "models/jsnode.js"

    return models;
});
