
steller.js : .steller.tmp.js
	cljs --compilation_level=SIMPLE_OPTIMIZATIONS .steller.tmp.js > steller.js
	
.steller.tmp.js : src/*.js
	cd src && (gcc -E -x c main.js | grep -v '^#' > ../.steller.tmp.js)

clean : 
	rm steller.js .steller.tmp.js
