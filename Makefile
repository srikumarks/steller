CPP=gcc -E -x c -DDEBUG=0${DEBUG} -P -undef -Wundef -std=c99 -nostdinc -Wtrigraphs -fdollars-in-identifiers

steller.min.js : steller.js
	cljs --compilation_level=SIMPLE_OPTIMIZATIONS steller.js > steller.min.js
	
steller.js : lib/assert.js src/*.js
	cd src && ($(CPP) -include ../lib/assert.js main.js > ../steller.js)

clean : 
	rm steller.js steller.min.js
