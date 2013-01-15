CPP=/usr/bin/cpp -P -undef -Wundef -std=c99 -nostdinc -Wtrigraphs -fdollars-in-identifiers -C

steller.js : .steller.tmp.js
	cljs --compilation_level=SIMPLE_OPTIMIZATIONS .steller.tmp.js > steller.js
	
.steller.tmp.js : src/*.js
	cd src && ($(CPP) main.js | grep -v '^#' > ../.steller.tmp.js)

clean : 
	rm steller.js .steller.tmp.js
