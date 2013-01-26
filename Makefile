CPP=gcc -E -x c -DDEBUG=0${DEBUG} -P -undef -Wundef -std=c99 -nostdinc -Wtrigraphs -fdollars-in-identifiers

steller.min.js : steller.js
	cljs --compilation_level=SIMPLE_OPTIMIZATIONS steller.js > steller.min.js
	
steller.js : lib/assert.js src/*.js src/models/*.js
	cd src && ($(CPP) -include ../lib/assert.js main.js > ../steller.js)

clean : 
	rm steller.js steller.min.js

release : steller.js steller.min.js
	mv steller.js _steller.js 
	mv steller.min.js _steller.min.js
	git checkout release
	mv _steller.js steller.js
	mv _steller.min.js steller.min.js
	git add steller.js steller.min.js
	git commit
