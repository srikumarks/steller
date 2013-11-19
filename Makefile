CPP=gcc -E -x c -DDEBUG=0${DEBUG} -P -undef -Wundef -std=c99 -nostdinc -Wtrigraphs -fdollars-in-identifiers

steller.min.js : src/*.js src/models/*.js
	r.js -o name=src/main out=steller.min.js
	
clean : 
	rm steller.min.js

release : steller.min.js
	mv steller.min.js _steller.min.js
	git checkout release
	mv _steller.min.js steller.min.js
	git add steller.min.js
	git commit
